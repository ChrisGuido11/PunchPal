import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Timer">;

export default function TimerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const currentWorkout = useUserStore((s) => s.currentWorkout);
  const addWorkoutToHistory = useUserStore((s) => s.addWorkoutToHistory);

  const [currentRound, setCurrentRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [isRunning, setIsRunning] = useState(false);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const handleRoundComplete = useCallback(() => {
    if (!currentWorkout) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (currentRound >= currentWorkout.rounds) {
      addWorkoutToHistory({
        id: `history-${Date.now()}`,
        workoutPlanId: currentWorkout.id,
        completedAt: new Date(),
        duration: currentWorkout.duration,
        rounds: currentWorkout.rounds,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Home");
    } else {
      setCurrentRound((prev) => prev + 1);
      setTimeRemaining(180);
    }
  }, [currentWorkout, currentRound, addWorkoutToHistory, navigation]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleRoundComplete();
            return 180;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, timeRemaining, handleRoundComplete]);

  useEffect(() => {
    if (isRunning && currentWorkout && timeRemaining % 60 === 0 && timeRemaining !== 180) {
      setCurrentComboIndex((prev) => (prev + 1) % currentWorkout.combos.length);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [timeRemaining, isRunning, currentWorkout]);

  const handleStartPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (!isRunning) {
      setIsRunning(true);
      setIsPaused(false);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  if (!currentWorkout) {
    return (
      <LinearGradient
        colors={["#0F0F0F", "#1A1A1A"]}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-xl">No workout selected</Text>
        </View>
      </LinearGradient>
    );
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const currentCombo = currentWorkout.combos[currentComboIndex];

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
        <View className="px-6">
          <View className="flex-row items-center justify-between mb-8">
            <Pressable onPress={handleStop}>
              <Text className="text-boxing-gold text-lg font-semibold">
                Back
              </Text>
            </Pressable>
            <View>
              <Text className="text-gray-400 text-sm text-right">Round</Text>
              <Text className="text-white text-2xl font-bold text-right">
                {currentRound} / {currentWorkout.rounds}
              </Text>
            </View>
          </View>

          <View className="items-center mb-12">
            <Text className="text-8xl font-black text-white tracking-tight mb-2">
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </Text>
            <Text className="text-xl text-gray-400">
              {isPaused ? "Paused" : isRunning ? "Training" : "Ready"}
            </Text>
          </View>

          <View className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-3xl p-8 mb-8">
            <Text className="text-gray-400 text-sm mb-2">Current Combo</Text>
            <Text className="text-3xl font-black text-white mb-3">
              {currentCombo?.name ?? "Loading..."}
            </Text>
            <Text className="text-4xl font-bold text-boxing-gold mb-4">
              {currentCombo?.notation ?? ""}
            </Text>
            <Text className="text-base text-gray-300">
              {currentCombo?.description ?? ""}
            </Text>
          </View>

          <View className="space-y-4">
            <Pressable onPress={handleStartPause} className="active:opacity-80">
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                style={{
                  paddingVertical: 20,
                  paddingHorizontal: 32,
                  borderRadius: 16,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text className="text-white text-2xl font-bold text-center">
                  {!isRunning ? "Start" : isPaused ? "Resume" : "Pause"}
                </Text>
              </LinearGradient>
            </Pressable>

            {isRunning && (
              <Pressable
                onPress={handleStop}
                className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-2xl py-5 active:opacity-80"
              >
                <Text className="text-white text-xl font-bold text-center">
                  End Workout
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
