import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakCard({
  currentStreak,
  longestStreak,
}: StreakCardProps) {
  return (
    <View className="mx-6 mb-3">
      <View className="relative">
        <View
          style={{
            position: "absolute",
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: 16,
            opacity: 0.2,
          }}
        >
          <LinearGradient
            colors={["#DC2626", "#D4AF37"]}
            style={{
              flex: 1,
              borderRadius: 16,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        <View className="bg-boxing-dark rounded-2xl border border-white/10 px-4 py-3">
          <View className="flex-row items-center justify-around">
            <View className="items-center">
              <Text className="text-2xl font-black text-boxing-red">
                {currentStreak}
              </Text>
              <Text className="text-[10px] text-boxing-gold font-bold uppercase tracking-wide mt-0.5">
                CURRENT
              </Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-black text-boxing-gold">
                {longestStreak}
              </Text>
              <Text className="text-[10px] text-white font-bold uppercase tracking-wide mt-0.5">
                LONGEST
              </Text>
            </View>
          </View>

          {currentStreak === 0 && (
            <Text className="text-center text-white/50 mt-2 text-[11px]">
              Complete a workout to start your streak!
            </Text>
          )}

          {currentStreak > 0 && currentStreak < 7 && (
            <Text className="text-center text-white/50 mt-2 text-[11px]">
              {7 - currentStreak} more day{7 - currentStreak !== 1 ? "s" : ""} to reach 1 week!
            </Text>
          )}

          {currentStreak >= 7 && currentStreak < 30 && (
            <Text className="text-center text-white/50 mt-2 text-[11px]">
              {30 - currentStreak} more day{30 - currentStreak !== 1 ? "s" : ""} to reach 30 days!
            </Text>
          )}

          {currentStreak >= 30 && (
            <Text className="text-center text-boxing-gold mt-2 text-[11px] font-bold">
              🏆 LEGENDARY STREAK! 🏆
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
