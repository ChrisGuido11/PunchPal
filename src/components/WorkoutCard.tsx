import React from "react";
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onStartTraining();
  };

  const difficultyColor = {
    beginner: "text-green-400",
    intermediate: "text-boxing-gold",
    advanced: "text-boxing-red",
  }[workout.difficulty];

  return (
    <View className="mx-6">
      <View className="relative">
        <View
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 24,
            opacity: 0.4,
          }}
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
        </View>

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

            <Pressable onPress={handlePress} className="active:opacity-80">
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
          </View>
        </View>
      </View>
    </View>
  );
}
