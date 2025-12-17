import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useUserStore } from "../state/userStore";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useUserStore(
    (s) => s.hasCompletedOnboarding
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasCompletedOnboarding) {
        navigation.replace("MainTabs");
      } else {
        navigation.replace("Onboarding");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, navigation]);

  return (
    <LinearGradient
      colors={["#000000", "#1A0000", "#000000"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center">
          {/* Minimalist boxing icon */}
          <View className="mb-8">
            <View className="w-24 h-24 rounded-full border-4 border-boxing-red items-center justify-center">
              <View className="w-16 h-16 rounded-full bg-boxing-red opacity-80" />
              <View className="absolute w-12 h-12 rounded-full border-2 border-boxing-gold" />
            </View>
          </View>
          <Text className="text-5xl font-black text-white tracking-tight mb-2">
            PunchPal
          </Text>
          <Text className="text-lg text-boxing-gold mt-1 tracking-wide font-semibold">
            Your AI Boxing Coach
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
