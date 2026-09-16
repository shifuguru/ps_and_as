/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    web: {
      ...(appJson.expo.web ?? {}),
      // Do NOT set themeColor — iOS Home Screen paints it as a frosted status
      // plate over the full-bleed felt. syncWebAppearanceChrome strips any
      // leftover meta tags; keep Expo from injecting one in the first place.
      // Match the black splash canvas so Expo does not flash casino green first paint.
      backgroundColor: "#000000",
    },
    experiments: {
      ...(appJson.expo.experiments ?? {}),
      // Override the default GitHub Pages subpath (/ps_and_as) for deploy
      // targets served from a domain root (e.g. psandas.com). Local dev,
      // staging, and any build without APP_BASE_URL set keep the app.json
      // default so nothing else in the pipeline needs to change.
      baseUrl:
        process.env.APP_BASE_URL !== undefined
          ? process.env.APP_BASE_URL
          : appJson.expo.experiments?.baseUrl,
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
