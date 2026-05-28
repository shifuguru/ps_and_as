/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      serverUrl: process.env.EXPO_PUBLIC_SERVER_URL?.trim() || null,
      buildId: process.env.EXPO_PUBLIC_BUILD_ID?.trim() || null,
      appVersion:
        process.env.EXPO_PUBLIC_APP_VERSION?.trim() ||
        appJson.expo.version ||
        "0.0.0",
    },
    plugins: [
      ...(appJson.expo.plugins ?? []),
      "expo-game-center",
    ],
  },
};
