const React = require("react");
const { View } = require("react-native");

function MapView(props) {
  // Simple non-interactive placeholder for web builds.
  return React.createElement(View, props, props.children);
}

function Marker() {
  // No-op marker on web; visual is handled by other map implementations.
  return null;
}

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
};

