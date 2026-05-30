const { runExpo } = require("./expo-dev-env");

runExpo(["--web", ...process.argv.slice(2)]);
