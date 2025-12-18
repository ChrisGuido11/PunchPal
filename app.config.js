module.exports = {
  expo: {
    name: "PunchPal",
    slug: "punchpal",
    scheme: "punchpal",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    icon: "./assets/logo.png",
    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.punchpal.app",
      infoPlist: {
        NSSpeechRecognitionUsageDescription: "PunchPal uses speech to call out combos during workouts",
        UIBackgroundModes: ["audio"],
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      package: "com.punchpal.app",
    },
    extra: {
      // This allows EAS secrets to be passed through to the app
      // Set GROK_API_KEY as an EAS secret, and it will be available here
      grokApiKey: process.env.GROK_API_KEY || process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY,
    },
  },
};
