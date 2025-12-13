import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { BoxingLevel } from "../types/workout";
import { useUserStore } from "../state/userStore";

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
  const setBoxingLevel = useUserStore((s) => s.setBoxingLevel);
  const setHasCompletedOnboarding = useUserStore(
    (s) => s.setHasCompletedOnboarding
  );

  const handleContinue = () => {
    if (!selectedLevel) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBoxingLevel(selectedLevel);
    setHasCompletedOnboarding(true);
    navigation.replace("MainTabs");
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
        contentContainerClassName="px-6 pt-20 pb-10"
      >
        <View className="mb-12">
          <Text className="text-4xl font-black text-white mb-3">
            Welcome to PunchPal
          </Text>
          <Text className="text-lg text-gray-400">
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
                    ? "border-boxing-gold"
                    : "border-boxing-cardBorder"
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl font-bold text-white">
                    {level.title}
                  </Text>
                  {selectedLevel === level.value && (
                    <Text className="text-2xl text-boxing-gold">✓</Text>
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
          <LinearGradient
            colors={
              selectedLevel
                ? ["#DC2626", "#B91C1C"]
                : ["#374151", "#1F2937"]
            }
            style={{
              paddingVertical: 18,
              paddingHorizontal: 32,
              borderRadius: 16,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text className="text-white text-xl font-bold text-center">
              Continue
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}
