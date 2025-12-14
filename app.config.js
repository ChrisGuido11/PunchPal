module.exports = {
  expo: {
    name: "vibecode",
    slug: "vibecode",
    scheme: "vibecode",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      edgeToEdgeEnabled: true,
    },
    extra: {
      // This allows EAS secrets to be passed through to the app
      // Set GROK_API_KEY as an EAS secret, and it will be available here
      grokApiKey: process.env.GROK_API_KEY || process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY,
    },
  },
};
