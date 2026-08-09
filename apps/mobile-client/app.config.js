const { expo } = require('./app.json');

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ??
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ??
  googleMapsApiKey;
const iosGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ??
  process.env.GOOGLE_MAPS_IOS_API_KEY ??
  googleMapsApiKey;
const reactNativeMapsPluginOptions = {
  ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
  ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
};

module.exports = () => ({
  ...expo,
  plugins: expo.plugins.map((plugin) =>
    plugin === 'react-native-maps'
      ? ['react-native-maps', reactNativeMapsPluginOptions]
      : plugin,
  ),
});
