import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import { BoxingLevel } from "../types/workout";
import { ACHIEVEMENTS, getAchievementProgress } from "../utils/achievements";

const levels: { value: BoxingLevel; title: string; description: string }[] = [
  {
    value: "beginner",
    title: "Beginner",
    description: "New to boxing, learning the basics",
  },
  {
    value: "intermediate",
    title: "Intermediate",
    description: "Comfortable with basic combos and footwork",
  },
  {
    value: "advanced",
    title: "Advanced",
    description: "Experienced boxer with refined technique",
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const boxingLevel = useUserStore((s) => s.boxingLevel);
  const setBoxingLevel = useUserStore((s) => s.setBoxingLevel);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const clearWorkoutHistory = useUserStore((s) => s.clearWorkoutHistory);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const longestStreak = useUserStore((s) => s.longestStreak);
  const unlockedAchievements = useUserStore((s) => s.unlockedAchievements);

  const [isEditingLevel, setIsEditingLevel] = useState(false);

  const handleLevelChange = (level: BoxingLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBoxingLevel(level);
    setIsEditingLevel(false);
  };

  const handleClearHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearWorkoutHistory();
  };

  const totalWorkouts = workoutHistory.length;
  const totalDuration = workoutHistory.reduce(
    (sum, workout) => sum + workout.duration,
    0
  );
  const totalRounds = workoutHistory.reduce(
    (sum, workout) => sum + workout.rounds,
    0
  );

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
          paddingBottom: insets.bottom + 80,
        }}
      >
        <View className="px-6 mb-8">
          <Text className="text-4xl font-black text-white mb-2">Profile</Text>
          <Text className="text-lg text-gray-400">
            Manage your training preferences
          </Text>
        </View>

        {/* Boxing Level Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Boxing Level
          </Text>
          <View className="bg-boxing-cardBg border border-boxing-cardBorder rounded-2xl p-5">
            {!isEditingLevel ? (
              <>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-2xl font-bold text-white">
                    {levels.find((l) => l.value === boxingLevel)?.title}
                  </Text>
                  <Text className="text-3xl">🥊</Text>
                </View>
                <Text className="text-base text-gray-400 mb-4">
                  {levels.find((l) => l.value === boxingLevel)?.description}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsEditingLevel(true);
                  }}
                  className="active:opacity-80"
                >
                  <LinearGradient
                    colors={["#DC2626", "#B91C1C"]}
                    style={{ borderRadius: 12, padding: 14 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text className="text-center text-white font-bold text-base">
                      Change Level
                    </Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <View className="space-y-3">
                {levels.map((level) => (
                  <Pressable
                    key={level.value}
                    onPress={() => handleLevelChange(level.value)}
                    className="active:opacity-90"
                  >
                    <View
                      className={`border-2 rounded-xl p-4 ${
                        boxingLevel === level.value
                          ? "border-boxing-gold bg-boxing-gold/10"
                          : "border-boxing-cardBorder"
                      }`}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-lg font-bold text-white">
                          {level.title}
                        </Text>
                        {boxingLevel === level.value && (
                          <Text className="text-xl text-boxing-gold">✓</Text>
                        )}
                      </View>
                      <Text className="text-sm text-gray-400">
                        {level.description}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsEditingLevel(false);
                  }}
                  className="active:opacity-80 mt-2"
                >
                  <View className="border border-gray-600 rounded-xl p-3">
                    <Text className="text-center text-gray-400 font-semibold">
                      Cancel
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Streaks Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Your Streak
          </Text>
          <View className="bg-gradient-to-r from-boxing-red/20 to-boxing-gold/20 border-2 border-boxing-gold rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-gray-400 text-sm mb-1">Current Streak</Text>
                <View className="flex-row items-end">
                  <Text className="text-5xl font-black text-boxing-gold">
                    {currentStreak}
                  </Text>
                  <Text className="text-2xl font-bold text-boxing-gold ml-2 mb-1">
                    🔥
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs mt-1">
                  {currentStreak === 0 ? "Start your streak today!" : 
                   currentStreak === 1 ? "Keep going!" : 
                   "days in a row"}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-sm mb-1">Best Streak</Text>
                <Text className="text-3xl font-black text-white">
                  {longestStreak}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">days</Text>
              </View>
            </View>
            {currentStreak >= 3 && (
              <View className="bg-black/30 rounded-xl p-3">
                <Text className="text-center text-boxing-gold text-sm font-semibold">
                  🎉 Amazing! Keep your streak alive by training daily!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Training Stats
          </Text>
          <View className="flex-row space-x-3">
            <View className="flex-1 bg-boxing-cardBg border border-boxing-cardBorder rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-gold mb-1">
                {totalWorkouts}
              </Text>
              <Text className="text-sm text-gray-400">
                Workout{totalWorkouts !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="flex-1 bg-boxing-cardBg border border-boxing-cardBorder rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-gold mb-1">
                {totalRounds}
              </Text>
              <Text className="text-sm text-gray-400">
                Round{totalRounds !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="flex-1 bg-boxing-cardBg border border-boxing-cardBorder rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-gold mb-1">
                {Math.floor(totalDuration / 60)}
              </Text>
              <Text className="text-sm text-gray-400">Minutes</Text>
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Achievements
          </Text>
          <View className="space-y-3">
            {ACHIEVEMENTS.slice(0, 6).map((achievement) => {
              const isUnlocked = unlockedAchievements.includes(achievement.id);
              const progress = getAchievementProgress(achievement.id, workoutHistory, currentStreak);
              const progressPercent = Math.min((progress.current / progress.target) * 100, 100);

              return (
                <View
                  key={achievement.id}
                  className={`rounded-2xl p-4 border ${
                    isUnlocked
                      ? "bg-boxing-gold/10 border-boxing-gold"
                      : "bg-boxing-cardBg border-boxing-cardBorder"
                  }`}
                >
                  <View className="flex-row items-center mb-2">
                    <Text className="text-4xl mr-3">{achievement.icon}</Text>
                    <View className="flex-1">
                      <Text className={`text-lg font-bold ${isUnlocked ? "text-white" : "text-gray-500"}`}>
                        {achievement.title}
                      </Text>
                      <Text className={`text-sm ${isUnlocked ? "text-gray-300" : "text-gray-600"}`}>
                        {achievement.description}
                      </Text>
                    </View>
                    {isUnlocked && (
                      <Text className="text-2xl">✓</Text>
                    )}
                    {achievement.isPremium && !isUnlocked && (
                      <View className="bg-boxing-gold/20 px-2 py-1 rounded">
                        <Text className="text-xs text-boxing-gold font-bold">PRO</Text>
                      </View>
                    )}
                  </View>
                  {!isUnlocked && (
                    <View className="mt-2">
                      <View className="h-2 bg-black/30 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-boxing-gold rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </View>
                      <Text className="text-xs text-gray-500 mt-1">
                        {progress.current} / {progress.target}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Workout History Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-white">
              Workout History
            </Text>
            {workoutHistory.length > 0 && (
              <Pressable
                onPress={handleClearHistory}
                className="active:opacity-70"
              >
                <Text className="text-sm text-boxing-red font-semibold">
                  Clear All
                </Text>
              </Pressable>
            )}
          </View>

          {workoutHistory.length === 0 ? (
            <View className="bg-boxing-cardBg border border-boxing-cardBorder rounded-2xl p-8">
              <Text className="text-center text-gray-400 text-base">
                No workouts completed yet
              </Text>
              <Text className="text-center text-gray-500 text-sm mt-2">
                Complete your first workout to see it here!
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {workoutHistory.slice(0, 10).map((workout, index) => (
                <View
                  key={workout.id}
                  className="bg-boxing-cardBg border border-boxing-cardBorder rounded-xl p-4"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-bold text-white">
                      Workout #{workoutHistory.length - index}
                    </Text>
                    <View className="bg-boxing-gold/20 px-3 py-1 rounded-full">
                      <Text className="text-xs font-semibold text-boxing-gold">
                        {workout.rounds} rounds
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center space-x-4">
                    <Text className="text-sm text-gray-400">
                      {Math.floor(workout.duration / 60)} min
                    </Text>
                    <Text className="text-gray-600">•</Text>
                    <Text className="text-sm text-gray-400">
                      {new Date(workout.completedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
              {workoutHistory.length > 10 && (
                <Text className="text-center text-gray-500 text-sm mt-2">
                  Showing 10 most recent workouts
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
