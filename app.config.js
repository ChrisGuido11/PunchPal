module.exports = {
  expo: {
    name: "PunchPal",
    slug: "punchpal",
    scheme: "punchpal",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    icon: "./icon.png",
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
      eas: {
        projectId: "019b16a7-0b29-747f-bcc9-6f2058b725f8",
      },
      grokApiKey: process.env.GROK_API_KEY || process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY,
    },
  },
};
