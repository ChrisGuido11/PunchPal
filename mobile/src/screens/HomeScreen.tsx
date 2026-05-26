import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import type { WorkoutMode } from "../types/workout";
import { generateWorkout } from "../api/workout-generator";
import WorkoutCard from "../components/WorkoutCard";
import StreakCard from "../components/StreakCard";
import WorkoutModeToggle from "../components/WorkoutModeToggle";
import PulsingEnergyLoader from "../components/PulsingEnergyLoader";
import BannerAdView from "../components/BannerAdView";
import { getUserStats, upsertUserStats } from "../api/database-service";
import { ensureDailyReminder } from "../utils/notifications";
import { INTERSTITIAL_AD_UNIT_ID, useInterstitial } from "../lib/ads";

type RootStackParamList = {
  Timer: undefined;
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
  const workoutMode = useUserStore((s) => s.workoutMode);
  const nextLevelProgress = useUserStore((s) => s.nextLevelProgress);
  const levelCapStayingSince = useUserStore((s) => s.levelCapStayingSince);
  const levelCapTooEasyCountSinceStay = useUserStore(
    (s) => s.levelCapTooEasyCountSinceStay
  );
  const demotionWindow = useUserStore((s) => s.demotionWindow);
  const recentComboSignatures = useUserStore((s) => s.recentComboSignatures);
  const pushComboSignatures = useUserStore((s) => s.pushComboSignatures);
  const hydrateProgressionFromDb = useUserStore(
    (s) => s.hydrateProgressionFromDb
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freshWorkoutAd = useInterstitial(INTERSTITIAL_AD_UNIT_ID);
  // Tracks the last mode we've reacted to. null until first render seeds it,
  // so cold launches with mismatched persisted state DON'T auto-regen.
  const lastAppliedModeRef = useRef<WorkoutMode | null>(null);

  // One-shot hydration from Supabase when the user becomes known.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stats = await getUserStats(userId);
      if (cancelled || !stats) return;
      hydrateProgressionFromDb({
        nextLevelProgress: stats.nextLevelProgress,
        levelCapStayingSince: stats.levelCapStayingSince,
        levelCapTooEasyCountSinceStay: stats.levelCapTooEasyCountSinceStay,
        demotionWindow: stats.demotionWindow,
        recentComboSignatures: stats.recentComboSignatures,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateProgressionFromDb, userId]);

  useEffect(() => {
    updateStreaks();
    ensureDailyReminder();
    if (!currentWorkout && boxingLevel) {
      loadWorkout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkout, boxingLevel]);

  const loadWorkout = async () => {
    if (!boxingLevel) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Sync durable stats to Supabase for AI personalization. The
      // rating-driven progression fields (nextLevelProgress, level-cap state,
      // demotion window, signatures) are owned by TimerScreen's finishWorkout
      // path — only push them here if they're already present in the store.
      if (userId) {
        const totalMinutes = workoutHistory.reduce(
          (sum, w) => sum + (w.duration || 0),
          0
        );
        const combosCompleted = new Set(
          workoutHistory.flatMap((w) => w.combos || [])
        ).size;

        await upsertUserStats(userId, {
          userId,
          totalWorkouts: workoutHistory.length,
          totalMinutes,
          currentLevel: boxingLevel,
          nextLevelProgress,
          combosLearned: combosCompleted,
          currentStreak,
          longestStreak,
          lastWorkoutDate:
            workoutHistory.length > 0
              ? new Date(workoutHistory[0].completedAt).toISOString()
              : null,
          levelCapStayingSince,
          levelCapTooEasyCountSinceStay,
          recentComboSignatures,
          demotionWindow,
        });
      }

      const workout = await generateWorkout(
        boxingLevel,
        workoutHistory.length,
        "power",
        userId,
        workoutMode
      );
      setCurrentWorkout(workout);
      // Push the generated anchors into the variety ring buffer so that the
      // NEXT "Get Fresh Workout" press sees an avoid-list including the combos
      // we just showed. Without this, repeated regens before completion send
      // identical inputs to the EF and produce near-identical workouts.
      pushComboSignatures(workout.rounds.map((r) => r.anchorCombo.notation));
    } catch (err) {
      console.error("Failed to generate workout:", err);
      setError("Failed to generate workout. Please try again.");
    } finally {
      setIsGenerating(false);
    }
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

  // When the user toggles Classic ↔ Dynamic, the persisted workout was built
  // for the OTHER mode (different description/reminders structure). Regenerate
  // via the same interstitial path as Get Fresh Workout, so toggle-spam is
  // rate-limited by the 30s ad-frequency cap.
  useEffect(() => {
    if (lastAppliedModeRef.current === null) {
      lastAppliedModeRef.current = workoutMode;
      return;
    }
    if (lastAppliedModeRef.current === workoutMode) return;
    lastAppliedModeRef.current = workoutMode;
    if (!boxingLevel || isGenerating) return;
    // Pre-fix workouts (no mode field) or no workout at all → skip.
    if (!currentWorkout || !currentWorkout.mode) return;
    // Toggling back to the workout's original mode = no-op.
    if (currentWorkout.mode === workoutMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentWorkout(null);
    freshWorkoutAd.show(() => {
      loadWorkout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutMode]);

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
          paddingTop: insets.top + 8,
          paddingBottom: 12,
        }}
      >
        <View className="px-6 mb-2">
          <View className="flex-row items-center">
            <Image
              source={require("../../assets/logo.png")}
              style={{ width: 38, height: 38, marginRight: 10 }}
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
            <WorkoutModeToggle disabled={isGenerating} />
            <WorkoutCard
              workout={currentWorkout}
              onStartTraining={handleStartTraining}
            />

            {!isGenerating && boxingLevel ? (
              <View className="px-6 mt-3">
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
                      style={{
                        backgroundColor: "#000000",
                        borderRadius: 14,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                      }}
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

      <BannerAdView />
    </LinearGradient>
  );
}
