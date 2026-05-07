import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import BackgroundGeolocation from "react-native-background-geolocation";

const BASE_URL = "http://192.168.0.119:4004/api/v1/";

const HeadlessTask = async (event) => {
  console.log("📡 Headless event:", event.name);

  if (event.name === "location") {
    const location = event.params;

    let payload; // ✅ FIX

    try {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4Mzc5YjJjMy1hZGIxLTQwOTMtYTk3YS03OWIzYzU4MWNkNTkiLCJ0ZW5hbnRJZCI6IjQ4OWQ2OWE5LTNkZWMtNGFkMi05N2NlLTA0MjQzMWM0NDQwMiIsInJvbGVfaWQiOiI0ZjE1MWY2ZS0wODZjLTQxZWMtYjJjNi01OWJkNWRjZTFiMGYiLCJyb2xlX25hbWUiOiJUZW5hbnQgQWRtaW4iLCJpYXQiOjE3NzgwNjI1MzYsImV4cCI6MTgwOTU5ODUzNn0.gzlE1UnhQl5Q_GnHnYhRA7KAuR9BxO99Iq48gakTNtE"

      if (!token) return;

      const { latitude, longitude, accuracy } = location.coords;

      payload = {
        latitude,
        longitude,
        gps_accuracy: accuracy,
        battery_percent: 0,
        movement_state: "Standard",
        timing: new Date().toISOString(),
      };

      await fetch(`${BASE_URL}fieldsense/geological-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("✅ Headless location sent");

    } catch (e) {
      console.log(" Headless error:", e);
    }
  }
};

BackgroundGeolocation.registerHeadlessTask(HeadlessTask);

AppRegistry.registerComponent(appName, () => App);