import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import { generateWorkout } from "../api/workout-generator";
import WorkoutCard from "../components/WorkoutCard";
import StreakCard from "../components/StreakCard";
import PulsingEnergyLoader from "../components/PulsingEnergyLoader";
import BannerAdView from "../components/BannerAdView";
import { upsertUserStats } from "../api/database-service";
import { ensureDailyReminder } from "../utils/notifications";
import { BoxingLevel } from "../types/workout";
import { INTERSTITIAL_AD_UNIT_ID, useInterstitial } from "../lib/ads";

const BANNER_RESERVED_HEIGHT = 60;

type RootStackParamList = {
  Timer: undefined;
  // Library: undefined; // TODO: enable library later
};

type Props = NativeStackScreenProps<RootStackParamList>;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
  const freshWorkoutAd = useInterstitial(INTERSTITIAL_AD_UNIT_ID);

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

  const handleRegenerate = () => {
    if (!boxingLevel || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentWorkout(null);
    freshWorkoutAd.show(() => {
      loadWorkout();
    });
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
          flexGrow: 1,
          paddingTop: insets.top + 12,
          paddingBottom: BANNER_RESERVED_HEIGHT + 16,
        }}
      >
        <View className="px-6 mb-4">
          <View className="flex-row items-center">
            <Image
              source={require("../../assets/logo.png")}
              style={{ width: 44, height: 44, marginRight: 10 }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-black text-white">PunchPal</Text>
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
            <StreakCard
              currentStreak={currentStreak}
              longestStreak={longestStreak}
            />
            <WorkoutCard
              workout={currentWorkout}
              onStartTraining={handleStartTraining}
            />

            {!isGenerating && boxingLevel ? (
              <View className="px-6 mt-8">
                <Pressable onPress={handleRegenerate} className="active:opacity-80">
                  <View className="relative">
                    <View
                      style={{
                        position: "absolute",
                        top: -3,
                        left: -3,
                        right: -3,
                        bottom: -3,
                        borderRadius: 18,
                        opacity: 0.3,
                      }}
                    >
                      <LinearGradient
                        colors={["#DC2626", "#D4AF37"]}
                        style={{ flex: 1, borderRadius: 18 }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    </View>
                    <View
                      style={{ backgroundColor: "#000000", borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }}
                    >
                      <Text className="text-white text-center text-base font-bold">
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

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: tabBarHeight,
        }}
        pointerEvents="box-none"
      >
        <BannerAdView />
      </View>
    </LinearGradient>
  );
}
