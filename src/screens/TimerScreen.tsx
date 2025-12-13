import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useUserStore } from "../state/userStore";
import { checkAchievements } from "../utils/achievements";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Timer">;



const WORK_DURATION = 180; // 3 minutes
const REST_DURATION = 60; // 1 minute

type Phase = "work" | "rest";

function TimerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const currentWorkout = useUserStore((s) => s.currentWorkout);
  const addWorkoutToHistory = useUserStore((s) => s.addWorkoutToHistory);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const longestStreak = useUserStore((s) => s.longestStreak);
  const unlockedAchievements = useUserStore((s) => s.unlockedAchievements);
  const unlockAchievement = useUserStore((s) => s.unlockAchievement);

  const [currentRound, setCurrentRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("work");
  const [timeRemaining, setTimeRemaining] = useState(WORK_DURATION);
  const [restRemaining, setRestRemaining] = useState(REST_DURATION);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const totalRounds = currentWorkout?.rounds ?? 1;
  const combos = currentWorkout?.combos ?? [];

  const combo = useMemo(() => combos[currentComboIndex], [combos, currentComboIndex]);

  const finishWorkout = useCallback(() => {
    if (!currentWorkout) return;

    const completedAt = new Date();
    const entry = {
      id: `history-${Date.now()}`,
      workoutPlanId: currentWorkout.id,
      completedAt,
      duration: currentWorkout.duration,
      rounds: currentWorkout.rounds,
      workoutName: currentWorkout.name,
      workoutType: currentWorkout.type,
    };

    addWorkoutToHistory(entry);

    // Allow store to settle before evaluating achievements.
    setTimeout(() => {
      const newAchievements = checkAchievements(
        [entry, ...workoutHistory],
        currentStreak,
        longestStreak,
        unlockedAchievements
      );
      newAchievements.forEach((id) => unlockAchievement(id));
    }, 100);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate("Home");
  }, [addWorkoutToHistory, currentWorkout, currentStreak, longestStreak, navigation, unlockAchievement, unlockedAchievements, workoutHistory]);

  const startRest = useCallback(() => {
    setPhase("rest");
    setRestRemaining(REST_DURATION);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const startNextRound = useCallback(() => {
    setCurrentRound((r) => r + 1);
    setTimeRemaining(WORK_DURATION);
    setRestRemaining(REST_DURATION);
    setPhase("work");
    setCurrentComboIndex((i) => (i + 1) % (combos.length || 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [combos.length]);

  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      if (phase === "work") {
        setTimeRemaining((t) => {
          if (t <= 1) {
            if (currentRound >= totalRounds) {
              finishWorkout();
              return 0;
            }
            startRest();
            return 0;
          }
          return t - 1;
        });
      } else {
        setRestRemaining((r) => {
          if (r <= 1) {
            startNextRound();
            return REST_DURATION;
          }
          return r - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRound, finishWorkout, isPaused, isRunning, phase, startNextRound, startRest, totalRounds]);

  useEffect(() => {
    if (!isRunning || combos.length === 0 || phase !== "work") return;
    if (timeRemaining % 60 === 0 && timeRemaining !== WORK_DURATION) {
      setCurrentComboIndex((i) => (i + 1) % combos.length);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [combos.length, isRunning, phase, timeRemaining]);

  const toggleRunning = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!isRunning) {
      setIsRunning(true);
      setIsPaused(false);
      return;
    }
    setIsPaused((p) => !p);
  };

  const endWorkout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const watchLesson = async () => {
    if (!combo) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const query = `boxing ${combo.name} tutorial ${combo.notation}`;
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    try {
      const canOpen = await Linking.canOpenURL(youtubeSearchUrl);
      if (canOpen) {
        await Linking.openURL(youtubeSearchUrl);
      }
    } catch (error) {
      console.error("Error opening YouTube:", error);
    }
  };

  if (!currentWorkout || combos.length === 0) {
    return (
      <LinearGradient colors={["#0F0F0F", "#1A1A1A"]} style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-xl">No workout selected</Text>
        </View>
      </LinearGradient>
    );
  }

  const displaySeconds = phase === "work" ? timeRemaining : restRemaining;
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  return (
    <LinearGradient colors={["#0F0F0F", "#1A1A1A"]} style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="px-6">
          <View className="flex-row items-center justify-between mb-8">
            <Pressable onPress={endWorkout}>
              <Text className="text-boxing-gold text-lg font-semibold">Back</Text>
            </Pressable>
            <View>
              <Text className="text-gray-400 text-sm text-right">Round</Text>
              <Text className="text-white text-2xl font-bold text-right">
                {currentRound} / {totalRounds}
              </Text>
            </View>
          </View>

          <View className="items-center mb-6">
            <Text className="text-8xl font-black text-white tracking-tight mb-2">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </Text>
            <Text className="text-xl text-gray-400">
              {isPaused
                ? "Paused"
                : phase === "rest"
                  ? "Rest"
                  : isRunning
                    ? "Training"
                    : "Ready"}
            </Text>
          </View>

          {phase === "rest" && (
            <View className="bg-boxing-gold/15 border border-boxing-gold rounded-2xl p-4 mb-6">
              <Text className="text-boxing-gold text-center font-bold text-base">
                Rest - Next round starts soon
              </Text>
            </View>
          )}

          <View className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-3xl p-8 mb-8">
            <Text className="text-gray-400 text-sm mb-2">Current Combo</Text>
            <Text className="text-3xl font-black text-white mb-3">{combo?.name ?? "---"}</Text>
            <Text className="text-4xl font-bold text-boxing-gold mb-4">{combo?.notation ?? "---"}</Text>
            <Text className="text-base text-gray-300 mb-4">{combo?.description ?? ""}</Text>

            <Pressable onPress={watchLesson} className="active:opacity-70 mt-2">
              <View className="bg-boxing-gold/10 border border-boxing-gold rounded-xl py-3 px-4 flex-row items-center justify-center">
                <Text className="text-boxing-gold text-base font-bold">📺 Watch Lesson on YouTube</Text>
              </View>
            </Pressable>
          </View>

          <View className="space-y-4">
            <Pressable onPress={toggleRunning} className="active:opacity-80">
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                style={{ paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16 }}
              >
                <Text className="text-white text-2xl font-bold text-center">
                  {!isRunning ? "Start" : isPaused ? "Resume" : "Pause"}
                </Text>
              </LinearGradient>
            </Pressable>

            {isRunning && (
              <Pressable
                onPress={endWorkout}
                className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-2xl py-5 active:opacity-80"
              >
                <Text className="text-white text-xl font-bold text-center">End Workout</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

export default TimerScreen;
