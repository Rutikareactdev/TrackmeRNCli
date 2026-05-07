import React, { useEffect } from "react";
import { View, Text, Button } from "react-native";
import BackgroundGeolocation from "react-native-background-geolocation";

const App = () => {

  const BASE_URL = "http://192.168.0.103:4004/api/v1/"; // replace with your API endpoint

  useEffect(() => {
    setupTracking();
    BackgroundGeolocation.start();

    const locationSub = BackgroundGeolocation.onLocation(async (location) => {
      const { latitude, longitude, accuracy, speed } = location.coords;

      console.log("📍 Location:", latitude, longitude);

      let payload; // ✅ declare outside

      try {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMGNmNGUwNy0yMWJmLTRiYjctOTRlZC05NWE5MjIxOGQxNTUiLCJ0ZW5hbnRJZCI6ImVlYTU3OTljLWMyZWYtNDJiMS05M2Q4LWY5NmQ2NmFjYjEyYyIsInJvbGVfaWQiOiJlZWE1Nzk5Yy1jMmVmLTQyYjEtOTNkOC1mOTZkNjZhY2IxMmQiLCJyb2xlX25hbWUiOiJUZW5hbnQgQWRtaW4iLCJpYXQiOjE3NzgxMjg3ODgsImV4cCI6MTc3ODIxNTE4OH0.3bA7X8komX9tO2QXSckCpiFFM8hWgq6uTiAZMfXBBaA"
        if (!token) return;

        const { latitude, longitude, accuracy, speed } = location.coords;

        /* -------- PAYLOAD -------- */
        payload = {
          latitude: latitude,
          longitude: longitude,
          gps_accuracy: accuracy,
          battery_percent: 0,
          movement_state: "MOVING",
          type:"Standard",
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
        console.log("Location submitted", res.json());

      } catch (e) {
        console.log("BG error → queue", e);
      }

    });

    const motionSub = BackgroundGeolocation.onMotionChange((event) => {
      console.log("🚶 Motion:", event.isMoving ? "MOVING" : "STOPPED");
    });

    return () => {
      locationSub.remove();
      motionSub.remove();
    };
  }, []);

  const setupTracking = async () => {
    const state = await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,

      // 🔥 FORCE frequent updates
      distanceFilter: 0, // IMPORTANT: no movement dependency

      locationUpdateInterval: 10000,          // 10 sec Android
      fastestLocationUpdateInterval: 5000,

      interval: 10000, // fallback scheduler (Android)

      // 🔥 Background persistence
      stopOnTerminate: false,
      startOnBoot: true,

      // 🔥 REQUIRED for background execution
      foregroundService: true,
      enableHeadless: true,

      // 🔥 Prevent auto stop
      stopTimeout: 0,

      // ⚡ keep CPU awake for tracking
      pausesLocationUpdatesAutomatically: false,

      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    });

    console.log("✅ Tracking ready:", state.enabled);
  };

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