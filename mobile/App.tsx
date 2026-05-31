import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Updates from "expo-updates";
import * as SplashScreen from "expo-splash-screen";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import RootNavigator from "./src/navigation/RootNavigator";
import { useAppOpenAd } from "./src/lib/ads";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

Audio.setAudioModeAsync({
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  allowsRecordingIOS: false,
}).catch(() => {});

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project.
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  // App Open ad (Android only) — shows on cold launch and on resume from
  // background. Self-disables on iOS / Expo Go, so it is safe to call here.
  useAppOpenAd();

  // Explicit OTA check on cold launch. Updates.isEnabled is false in Expo Go
  // and dev client, so this only fires on preview / production builds. Fetches
  // silently and reloads — user sees the new bundle on next cold open.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Silent fail — app continues on the current bundle.
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          onReady={() => SplashScreen.hideAsync().catch(() => {})}
        >
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
