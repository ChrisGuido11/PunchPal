import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useUserStore } from "../state/userStore";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  const hasCompletedOnboarding = useUserStore(
    (s) => s.hasCompletedOnboarding
  );

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10 });
    opacity.value = withSequence(
      withDelay(200, withSpring(1)),
      withDelay(1500, withSpring(0))
    );

    const timer = setTimeout(() => {
      if (hasCompletedOnboarding) {
        navigation.replace("Home");
      } else {
        navigation.replace("Onboarding");
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, navigation]);

  return (
    <LinearGradient
      colors={["#0F0F0F", "#1A1A1A", "#0F0F0F"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={animatedStyle} className="items-center">
          <Text className="text-6xl font-bold text-boxing-gold mb-4">
            🥊
          </Text>
          <Text className="text-5xl font-black text-white tracking-tight">
            PunchPal
          </Text>
          <Text className="text-lg text-gray-400 mt-2 tracking-wide">
            Your AI Boxing Coach
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}
