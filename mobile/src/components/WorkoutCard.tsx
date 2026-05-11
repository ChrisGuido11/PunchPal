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
    beginner: "text-boxing-gold",
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
            opacity: 0.3,
          }}
        >
          <LinearGradient
            colors={["#DC2626", "#D4AF37"]}
            style={{
              flex: 1,
              borderRadius: 24,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        <View className="bg-boxing-cardBg border-2 border-boxing-red rounded-3xl overflow-hidden">
          <View className="p-6">
            <View className="mb-5">
              <Text
                className={`text-xs font-bold tracking-widest mb-2 ${difficultyColor}`}
              >
                {workout.difficulty.toUpperCase()}
              </Text>
              <Text
                className="text-3xl font-black text-white mb-1"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {workout.name.split(":")[0]}:
              </Text>
              <Text className="text-xl font-bold text-gray-200">
                {workout.name.split(":").slice(1).join(":").trim()}
              </Text>
            </View>

            <View className="flex-row justify-center space-x-3 mb-5">
              <View
                className="bg-black/30 rounded-xl py-3 items-center"
                style={{ width: 120 }}
              >
                <Text className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider">
                  Duration
                </Text>
                <Text
                  className="text-white text-2xl font-bold"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {workout.duration} min
                </Text>
              </View>

              <View
                className="bg-black/30 rounded-xl py-3 items-center"
                style={{ width: 120 }}
              >
                <Text className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider">
                  Rounds
                </Text>
                <Text className="text-white text-2xl font-bold">
                  {workout.rounds}
                </Text>
              </View>
            </View>

            <Pressable onPress={handlePress} className="active:opacity-80">
              <View
                style={{
                  backgroundColor: "#000000",
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  borderRadius: 16,
                }}
              >
                <Text className="text-white text-xl font-bold text-center">
                  Start Training
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
