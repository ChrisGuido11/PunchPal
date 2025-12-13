import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { WorkoutPlan } from "../types/workout";

interface WorkoutCardProps {
  workout: WorkoutPlan;
  onStartTraining: () => void;
}

export default function WorkoutCard({
  workout,
  onStartTraining,
}: WorkoutCardProps) {
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: cardScale.value }],
      opacity: cardOpacity.value,
    };
  });

  const glowAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 12 });
    cardOpacity.value = withSpring(1);

    glowOpacity.value = withSequence(
      withDelay(300, withTiming(0.8, { duration: 400 })),
      withTiming(0.4, { duration: 600 })
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [workout]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    buttonScale.value = withSpring(0.92, { damping: 10 }, () => {
      buttonScale.value = withSpring(1);
    });
    onStartTraining();
  };

  const difficultyColor = {
    beginner: "text-green-400",
    intermediate: "text-boxing-gold",
    advanced: "text-boxing-red",
  }[workout.difficulty];

  return (
    <Animated.View style={cardAnimatedStyle} className="mx-6">
      <View className="relative">
        <Animated.View
          style={[
            glowAnimatedStyle,
            {
              position: "absolute",
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderRadius: 24,
            },
          ]}
        >
          <LinearGradient
            colors={["#F59E0B", "#DC2626"]}
            style={{
              flex: 1,
              borderRadius: 24,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <View className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-3xl overflow-hidden">
          <View className="p-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-3xl font-black text-white mb-1">
                  {workout.name}
                </Text>
                <Text className={`text-sm font-semibold ${difficultyColor}`}>
                  {workout.difficulty.toUpperCase()}
                </Text>
              </View>
              <Text className="text-5xl">🥊</Text>
            </View>

            <View className="flex-row space-x-4 mb-6">
              <View className="flex-1 bg-black/30 rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Duration</Text>
                <Text className="text-white text-2xl font-bold">
                  {workout.duration} min
                </Text>
              </View>

              <View className="flex-1 bg-black/30 rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Rounds</Text>
                <Text className="text-white text-2xl font-bold">
                  {workout.rounds}
                </Text>
              </View>

              <View className="flex-1 bg-black/30 rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Combos</Text>
                <Text className="text-white text-2xl font-bold">
                  {workout.combos.length}
                </Text>
              </View>
            </View>

            <Animated.View style={buttonAnimatedStyle}>
              <Pressable onPress={handlePress} className="active:opacity-90">
                <LinearGradient
                  colors={["#DC2626", "#B91C1C"]}
                  style={{
                    paddingVertical: 18,
                    paddingHorizontal: 32,
                    borderRadius: 16,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text className="text-white text-xl font-bold text-center">
                    Start Training
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
