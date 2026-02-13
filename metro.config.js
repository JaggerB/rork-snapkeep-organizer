const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Make Rork toolkit integration optional so builds don't fail
// in environments where the package isn't installed (e.g. Vercel).
let withRorkMetro = (config) => config;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  ({ withRorkMetro } = require("@rork-ai/toolkit-sdk/metro"));
} catch (e) {
  // Safe fallback: just use the default Expo Metro config
  console.warn("[metro.config] @rork-ai/toolkit-sdk/metro not found, using default config");
}

const config = getDefaultConfig(__dirname);

// Alias react-native-maps to a lightweight stub so that
// native-only internals aren't pulled into web/server builds.
// (On native, this will render a simple non-interactive container.)
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "react-native-maps": path.resolve(__dirname, "metro-stubs/react-native-maps.web.js"),
};

module.exports = withRorkMetro(config);
