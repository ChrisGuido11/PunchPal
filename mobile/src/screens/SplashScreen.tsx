import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useUserStore } from "../state/userStore";
import { initializeUser } from "../api/user-service";

type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useUserStore(
    (s) => s.hasCompletedOnboarding
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Kick off anonymous Supabase sign-in in the background so cloud sync works
    // without forcing the user through a sign-up gate.
    initializeUser().catch(() => {
      // Ignore — app still works locally if Supabase is unreachable.
    });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      if (hasCompletedOnboarding) {
        navigation.replace("MainTabs");
      } else {
        navigation.replace("Onboarding");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, navigation, fadeAnim, scaleAnim]);

  return (
    <LinearGradient
      colors={["#000000", "#000000"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View 
          style={{
            alignItems: "center",
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Boxing Glove Logo */}
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 200, height: 200, marginBottom: 24, resizeMode: "contain" }}
          />
          <Text className="text-5xl font-black text-white tracking-tight mb-2">
            PunchPal
          </Text>
          <Text className="text-lg text-boxing-gold mt-2 tracking-wide font-semibold">
            Your AI Boxing Coach
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}
