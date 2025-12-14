/*
IMPORTANT NOTICE: DO NOT REMOVE
This is a custom client for the Grok API. You may update this service, but you should not need to.
The Grok API can be communicated with the "openai" package, so you can use the same functions as the openai package. It may not support all the same features, so please be careful.


grok-3-latest
grok-3-fast-latest
grok-3-mini-latest
*/
import OpenAI from "openai";
import Constants from "expo-constants";

export const getGrokClient = () => {
  // Check multiple possible sources for the API key
  // 1. EAS secrets (for production/TestFlight builds)
  // 2. expo-constants extra (for EAS builds)
  // 3. EXPO_PUBLIC_ env var (for development)
  const apiKey =
    Constants.expoConfig?.extra?.grokApiKey ||
    process.env.GROK_API_KEY ||
    process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY;

  if (!apiKey) {
    console.warn("Grok API key not found in environment variables");
  }

  return new OpenAI({
    apiKey: apiKey || "",
    baseURL: "https://api.x.ai/v1",
  });
};
