import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import { generateWorkout } from "../api/workout-generator";
import WorkoutCard from "../components/WorkoutCard";
import PulsingEnergyLoader from "../components/PulsingEnergyLoader";
import { upsertUserStats } from "../api/database-service";
import { ensureDailyReminder } from "../utils/notifications";
import { BoxingLevel } from "../types/workout";

type RootStackParamList = {
  Timer: undefined;
  // Library: undefined; // TODO: enable library later
};

type Props = NativeStackScreenProps<RootStackParamList>;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const userId = useUserStore((s) => s.userId);
  const boxingLevel = useUserStore((s) => s.boxingLevel);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const currentWorkout = useUserStore((s) => s.currentWorkout);
  const setCurrentWorkout = useUserStore((s) => s.setCurrentWorkout);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const longestStreak = useUserStore((s) => s.longestStreak);
  const updateStreaks = useUserStore((s) => s.updateStreaks);
  // const favoriteWorkouts = useUserStore((s) => s.favoriteWorkouts); // TODO: enable library later

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateStreaks();
    ensureDailyReminder();
    if (!currentWorkout && boxingLevel) {
      loadWorkout();
    }
  }, [currentWorkout, boxingLevel]);

  const loadWorkout = async () => {
    if (!boxingLevel) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Sync user stats to Supabase for AI personalization
      if (userId) {
        const totalMinutes = workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0);
        const combosCompleted = new Set(workoutHistory.flatMap(w => w.combos || [])).size;
        const avgAccuracy = workoutHistory.length > 0 
          ? workoutHistory.reduce((sum, w) => sum + (w.accuracy || 0), 0) / workoutHistory.length 
          : 0;
        
        await upsertUserStats(userId, {
          userId,
          totalWorkouts: workoutHistory.length,
          totalMinutes,
          currentLevel: boxingLevel,
          nextLevelProgress: calculateLevelProgress(workoutHistory.length, boxingLevel),
          combosLearned: combosCompleted,
          currentStreak,
          longestStreak,
          avgAccuracy: Math.round(avgAccuracy),
          lastWorkoutDate: workoutHistory.length > 0 
            ? new Date(workoutHistory[workoutHistory.length - 1].completedAt).toISOString() 
            : null,
        });
      }

      // Generate workout with personalized data from Supabase
      const workout = await generateWorkout(boxingLevel, workoutHistory.length, "power", userId);
      setCurrentWorkout(workout);
    } catch (err) {
      console.error("Failed to generate workout:", err);
      setError("Failed to generate workout. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate level progress based on workouts completed
  const calculateLevelProgress = (workouts: number, level: BoxingLevel): number => {
    const thresholds = { beginner: 20, intermediate: 50, advanced: 100 };
    const threshold = thresholds[level];
    return Math.min(Math.round((workouts / threshold) * 100), 100);
  };

  const handleStartTraining = () => {
    navigation.navigate("Timer");
  };

  const handleRegenerate = async () => {
    if (!boxingLevel || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentWorkout(null);
    await loadWorkout();
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
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Image
                  source={require("../../assets/logo.png")}
                  style={{ width: 64, height: 64, marginRight: 12 }}
                  resizeMode="contain"
                />
                <Text className="text-4xl font-black text-white">
                  PunchPal
                </Text>
              </View>
              <Text className="text-lg text-boxing-gold">
                Your personalized workout is ready
              </Text>
            </View>
            {currentStreak > 0 && (
              <View className="bg-boxing-red/20 border-2 border-boxing-red rounded-2xl px-4 py-3 items-center">
                <Text className="text-3xl font-black text-boxing-red">
                  {currentStreak}
                </Text>
                <Text className="text-xs text-boxing-gold font-bold uppercase tracking-wider">
                  STREAK
                </Text>
              </View>
            )}
          </View>
        </View>
        {isGenerating && <PulsingEnergyLoader />}

        {error ? (
          <View className="mx-6 mb-6 bg-boxing-red/20 border border-boxing-red rounded-2xl p-4">
            <Text className="text-boxing-red text-center">{error}</Text>
          </View>
        ) : null}

        {!isGenerating && currentWorkout ? (
          <>
            <WorkoutCard
              workout={currentWorkout}
              onStartTraining={handleStartTraining}
            />

            {__DEV__ && !isGenerating && boxingLevel ? (
              <View className="px-6 mt-4">
                <Pressable onPress={handleRegenerate} className="active:opacity-80">
                  <View className="relative">
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        borderRadius: 20,
                        opacity: 0.3,
                      }}
                    >
                      <LinearGradient
                        colors={["#DC2626", "#D4AF37"]}
                        style={{
                          flex: 1,
                          borderRadius: 20,
                        }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    </View>
                    <View
                      style={{ backgroundColor: '#000000', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 }}
                    >
                      <Text className="text-white text-center text-lg font-bold">
                        Get Fresh Workout
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}
