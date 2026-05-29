import "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import { registerRootComponent } from "expo";

import App from "./App";

if (Platform.OS === "web") {
  require("./src/utils/webNoZoom").ensureWebNoZoom();
  const {
    installWebShellCss,
    installWebMobileViewportGuard,
  } = require("./src/utils/webViewport");
  const { getWebBodyPortalHost } = require("./src/utils/webBodyPortal");
  const { ensureWebFeltBackdrop } = require("./src/styles/webFullBleed");
  const { DEFAULT_FELT_COLOR } = require("./src/services/wallpaper");
  installWebShellCss(DEFAULT_FELT_COLOR);
  ensureWebFeltBackdrop(DEFAULT_FELT_COLOR);
  getWebBodyPortalHost();
  installWebMobileViewportGuard();
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
