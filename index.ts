import "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import { registerRootComponent } from "expo";

import App from "./App";

if (Platform.OS === "web") {
  require("./src/utils/webNoZoom").ensureWebNoZoom();
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
