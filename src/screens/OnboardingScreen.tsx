import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { BoxingLevel } from "../types/workout";
import { useUserStore } from "../state/userStore";
import { upsertUserStats } from "../api/database-service";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

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

export default function OnboardingScreen({ navigation }: Props) {
  const [selectedLevel, setSelectedLevel] = useState<BoxingLevel | null>(null);
  const userId = useUserStore((s) => s.userId);
  const setBoxingLevel = useUserStore((s) => s.setBoxingLevel);
  const setHasCompletedOnboarding = useUserStore(
    (s) => s.setHasCompletedOnboarding
  );

  const handleContinue = async () => {
    if (!selectedLevel) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBoxingLevel(selectedLevel);
    setHasCompletedOnboarding(true);

    // Initialize user stats in Supabase with selected boxing level
    if (userId) {
      console.log('Onboarding: Saving user stats for userId:', userId);
      const result = await upsertUserStats(userId, {
        userId,
        totalWorkouts: 0,
        totalMinutes: 0,
        currentLevel: selectedLevel,
        nextLevelProgress: 0,
        combosLearned: 0,
        currentStreak: 0,
        longestStreak: 0,
        avgAccuracy: 0,
        lastWorkoutDate: null,
      });
      console.log('Onboarding: User stats save result:', result ? 'Success' : 'Failed');
    } else {
      console.log('Onboarding: No userId found, skipping Supabase sync');
    }

    navigation.replace("MainTabs");
  };

  return (
    <LinearGradient
      colors={["#000000", "#1A0000"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-20 pb-10"
      >
        <View className="mb-12">
          <Text className="text-4xl font-black text-white mb-3">
            Welcome to PunchPal
          </Text>
          <Text className="text-lg text-boxing-gold">
            Select your boxing experience level to get personalized workouts
          </Text>
        </View>

        <View className="space-y-4 mb-8">
          {levels.map((level) => (
            <Pressable
              key={level.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedLevel(level.value);
              }}
              className="active:opacity-90"
            >
              <View
                className={`bg-boxing-cardBg border-2 rounded-2xl p-6 ${
                  selectedLevel === level.value
                    ? "border-boxing-red"
                    : "border-boxing-cardBorder"
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl font-bold text-white">
                    {level.title}
                  </Text>
                  {selectedLevel === level.value && (
                    <Text className="text-2xl text-boxing-red font-black">✓</Text>
                  )}
                </View>
                <Text className="text-base text-gray-400">
                  {level.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={!selectedLevel}
          className="active:opacity-80"
        >
          <View
            style={{
              backgroundColor: selectedLevel ? '#000000' : '#374151',
              paddingVertical: 18,
              paddingHorizontal: 32,
              borderRadius: 16,
            }}
          >
            <Text className="text-white text-xl font-bold text-center">
              Continue
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}
