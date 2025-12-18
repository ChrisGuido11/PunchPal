module.exports = {
  expo: {
    name: "PunchPal",
    slug: "punchpal",
    scheme: "punchpal",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.punchpal.app",
      infoPlist: {
        NSMicrophoneUsageDescription: "PunchPal needs microphone access for audio feedback during workouts",
        NSSpeechRecognitionUsageDescription: "PunchPal uses speech to call out combos during workouts",
        NSUserNotificationsUsageDescription: "PunchPal sends daily reminders to keep your training streak alive"
      }
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
