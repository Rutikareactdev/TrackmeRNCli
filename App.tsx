import React, { useEffect, useRef } from "react";
import { View, Text, Button, PermissionsAndroid, Platform, Alert } from "react-native";
import BackgroundGeolocation from "react-native-background-geolocation";

const App = () => {
  const BASE_URL = "http://192.168.0.103:4004/api/v1/"; // replace with your API endpoint
  const TRACKING_INTERVAL_SECONDS = 5;
  const lastPostedAtRef = useRef(0);

  useEffect(() => {
    const desiredAccuracyHigh = (BackgroundGeolocation as any).DESIRED_ACCURACY_HIGH;
    const logLevelVerbose = (BackgroundGeolocation as any).LOG_LEVEL_VERBOSE;

    const setupTracking = async () => {
      const state = await BackgroundGeolocation.ready({
        desiredAccuracy: desiredAccuracyHigh,

        // 🔥 FORCE frequent updates
        distanceFilter: 0, // IMPORTANT: no movement dependency

        locationUpdateInterval: TRACKING_INTERVAL_SECONDS * 1000, // 20 sec Android
        fastestLocationUpdateInterval: 5000,

        interval: TRACKING_INTERVAL_SECONDS * 1000, // fallback scheduler (Android)
        heartbeatInterval: TRACKING_INTERVAL_SECONDS, // strict periodic trigger (sec)

        // 🔥 Background persistence
        stopOnTerminate: false,
        startOnBoot: true,

        // 🔥 REQUIRED for background execution
        foregroundService: true,
        enableHeadless: true,
        notification: {
          title: "Faciligent Tracking Active",
          text: "Location tracking is running in foreground",
          channelName: "Location Tracking",
          sticky: true,
        },

        // 🔥 Prevent auto stop
        stopTimeout: 0,

        // ⚡ keep CPU awake for tracking
        pausesLocationUpdatesAutomatically: false,
        preventSuspend: true,

        debug: true,
        logLevel: logLevelVerbose,
      } as any);

      console.log("✅ Tracking ready:", state.enabled);
    };

    const postLocation = async (location: any, source: "heartbeat" | "location") => {
      const now = Date.now();
      if (now - lastPostedAtRef.current < TRACKING_INTERVAL_SECONDS * 1000 - 250) {
        console.log(`⏭️ Skip duplicate post (${source})`);
        return;
      }
      lastPostedAtRef.current = now;

      const { latitude, longitude, accuracy } = location.coords;

      console.log(`📍 Location (${source}):`, latitude, longitude);

      // Ensure iOS/Android keep JS alive long enough to finish the request.
      // Without this, background JS can be paused mid-fetch (logs happen, network doesn't).
      const taskId = await (BackgroundGeolocation as any).startBackgroundTask();
      try {
        const token =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMGNmNGUwNy0yMWJmLTRiYjctOTRlZC05NWE5MjIxOGQxNTUiLCJ0ZW5hbnRJZCI6ImVlYTU3OTljLWMyZWYtNDJiMS05M2Q4LWY5NmQ2NmFjYjEyYyIsInJvbGVfaWQiOiJlZWE1Nzk5Yy1jMmVmLTQyYjEtOTNkOC1mOTZkNjZhY2IxMmQiLCJyb2xlX25hbWUiOiJUZW5hbnQgQWRtaW4iLCJpYXQiOjE3NzgxMjg3ODgsImV4cCI6MTc3ODIxNTE4OH0.3bA7X8komX9tO2QXSckCpiFFM8hWgq6uTiAZMfXBBaA";
        if (!token) return;

        const payload = {
          latitude,
          longitude,
          gps_accuracy: accuracy,
          battery_percent: 0,
          movement_state: "MOVING",
          type: "Standard",
          timing: new Date().toISOString(),
        };

        const res = await fetch(`${BASE_URL}fieldsense/geological-data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        console.log("✅ Location submitted", res.status, json);
      } catch (e) {
        console.log("BG error while posting location", e);
      } finally {
        try {
          await (BackgroundGeolocation as any).stopBackgroundTask(taskId);
        } catch {
          // ignore
        }
      }
    };

    const requestNotificationPermission = async () => {
      if (Platform.OS !== "android" || Platform.Version < 33) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      if (!isGranted) {
        Alert.alert(
          "Notification Permission Needed",
          "Foreground tracking requires notification permission on Android 13+."
        );
      }
      return isGranted;
    };

    const requestLocationPermissions = async () => {
      if (Platform.OS !== "android") return true;

      const fineLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          "Location Permission Needed",
          "Tracking requires precise location permission."
        );
        return false;
      }

      if (Platform.Version >= 29) {
        const backgroundLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
        if (backgroundLocation !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            "Background Location Needed",
            "Allow 'All the time' so tracking continues in background."
          );
          return false;
        }
      }

      return true;
    };

    // Avoid double-posting: heartbeat is the single source of truth for uploads.
    const locationSub = BackgroundGeolocation.onLocation(async (_location) => {
      console.log("📡 onLocation update received");
    });

    const heartbeatSub = BackgroundGeolocation.onHeartbeat(async () => {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          timeout: 30,
          maximumAge: 0,
          samples: 1,
          persist: false,
          desiredAccuracy: desiredAccuracyHigh,
        });
        await postLocation(location, "heartbeat");
      } catch (e) {
        console.log("Heartbeat getCurrentPosition failed", e);
      }
    });

    const motionSub = BackgroundGeolocation.onMotionChange((event) => {
      console.log("🚶 Motion:", event.isMoving ? "MOVING" : "STOPPED");
    });

    const init = async () => {
      const notificationGranted = await requestNotificationPermission();
      const locationGranted = await requestLocationPermissions();
      if (!notificationGranted || !locationGranted) return;

      await setupTracking();
      await BackgroundGeolocation.start();
    };
    init();

    return () => {
      locationSub.remove();
      heartbeatSub.remove();
      motionSub.remove();
    };
  }, []);

  const startTracking = async () => {
    const state = await BackgroundGeolocation.start();
    console.log("▶️ Tracking started:", state.enabled);
  };

  const stopTracking = async () => {
    await BackgroundGeolocation.stop();
    console.log("⛔ Tracking stopped");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>BG Location Tracker</Text>

      <Button title="Start Tracking" onPress={startTracking} />
      <View style={{ height: 20 }} />
      <Button title="Stop Tracking" onPress={stopTracking} />
    </View>
  );
};

export default App;