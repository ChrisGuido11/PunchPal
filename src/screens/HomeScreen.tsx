import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "../state/userStore";
import { generateWorkout } from "../api/workout-generator";
import WorkoutCard from "../components/WorkoutCard";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const boxingLevel = useUserStore((s) => s.boxingLevel);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const currentWorkout = useUserStore((s) => s.currentWorkout);
  const setCurrentWorkout = useUserStore((s) => s.setCurrentWorkout);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gloveRotation = useSharedValue(0);
  const gloveScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);

  const gloveAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${gloveRotation.value}deg` },
        { scale: gloveScale.value },
      ],
    };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  useEffect(() => {
    if (isGenerating) {
      gloveRotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
      gloveScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [isGenerating]);

  useEffect(() => {
    if (!currentWorkout && boxingLevel) {
      loadWorkout();
    }
  }, []);

  const loadWorkout = async () => {
    if (!boxingLevel) return;

    setIsGenerating(true);
    setError(null);

    try {
      const workout = await generateWorkout(boxingLevel, workoutHistory.length);
      setCurrentWorkout(workout);
    } catch (err) {
      console.error("Failed to generate workout:", err);
      setError("Failed to generate workout. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartTraining = () => {
    navigation.navigate("Timer");
  };

  return (
    <LinearGradient
      colors={["#0F0F0F", "#1A1A1A"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="px-6 mb-8">
          <Text className="text-4xl font-black text-white mb-2">
            Ready to Train?
          </Text>
          <Text className="text-lg text-gray-400">
            Your personalized workout is ready
          </Text>
        </View>

        {isGenerating && (
          <View className="items-center justify-center py-20">
            <View className="relative items-center justify-center">
              <Animated.View style={pulseAnimatedStyle}>
                <LinearGradient
                  colors={["#F59E0B", "#DC2626"]}
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    position: "absolute",
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>

              <Animated.View style={gloveAnimatedStyle}>
                <Text className="text-8xl">🥊</Text>
              </Animated.View>
            </View>

            <Text className="text-2xl font-bold text-white mt-8 mb-2">
              Generating Workout...
            </Text>
            <Text className="text-base text-gray-400 text-center px-8">
              Your coach is preparing a personalized training plan
            </Text>
          </View>
        )}

        {error && (
          <View className="mx-6 mb-6 bg-boxing-red/20 border border-boxing-red rounded-2xl p-4">
            <Text className="text-boxing-red text-center">{error}</Text>
          </View>
        )}

        {!isGenerating && currentWorkout && (
          <WorkoutCard
            workout={currentWorkout}
            onStartTraining={handleStartTraining}
          />
        )}
      </ScrollView>
    </LinearGradient>
  );
}
