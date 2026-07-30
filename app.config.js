/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    web: {
      ...(appJson.expo.web ?? {}),
      // Match the black splash canvas so Expo does not flash casino green first paint.
      backgroundColor: "#000000",
    },
    extra: {
      ...(appJson.expo.extra ?? {}),
      serverUrl: process.env.EXPO_PUBLIC_SERVER_URL?.trim() || null,
      buildId: process.env.EXPO_PUBLIC_BUILD_ID?.trim() || null,
      appVersion:
        process.env.EXPO_PUBLIC_APP_VERSION?.trim() ||
        appJson.expo.version ||
        "0.0.0",
    },
    // Game Center entitlements live in app.json — expo-game-center has no Expo config plugin.
    plugins: [...(appJson.expo.plugins ?? [])],
  },
};
