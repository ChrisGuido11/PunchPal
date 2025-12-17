import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
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

  const comboCalloutTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const lastComboKeyRef = useRef<string | null>(null);
  const tenSecondCalledRef = useRef(false);
  const lastBeepSecondRef = useRef<number | null>(null);
  const lastMinuteTenRef = useRef<number | null>(null);
  const lastRestBeepSecondRef = useRef<number | null>(null);
  const restSpokenRef = useRef<number | null>(null);
  const beepSoundRef = useRef<Audio.Sound | null>(null);

  const totalRounds = currentWorkout?.rounds ?? 1;
  const combos = currentWorkout?.combos ?? [];

  const combo = useMemo(() => combos[currentComboIndex], [combos, currentComboIndex]);

  const buildTips = useCallback((description?: string): string[] => {
    if (!description) return [];
    // Split on punctuation to capture concise guidance points.
    const parts = description
      .split(/[.;\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 6)
      .slice(0, 4);

    const rephrase = (text: string) => {
      const lowered = text.toLowerCase();
      if (lowered.startsWith("focus on")) return text.replace(/focus on/i, "focus on");
      if (lowered.startsWith("keep")) return text.replace(/keep/i, "keep");
      if (lowered.startsWith("stay")) return text.replace(/stay/i, "stay");
      if (lowered.startsWith("pivot")) return `pivot and stay balanced`; // small rephrase
      // Generic supportive prefix to avoid verbatim description.
      return `remember: ${text}`;
    };

    const tips = parts.map((p) => {
      const trimmed = p.replace(/\s+/g, " ").trim();
      const noTrailing = trimmed.replace(/[.]+$/, "");
      return rephrase(noTrailing);
    });

    const uniqueTips: string[] = [];
    for (const tip of tips) {
      if (tip && !uniqueTips.includes(tip)) uniqueTips.push(tip);
      if (uniqueTips.length === 2) break;
    }

    return uniqueTips;
  }, []);

  const speak = useCallback((text: string) => {
    Speech.speak(text, {
      language: "en-US",
      rate: 1,
      pitch: 1,
    });
  }, []);

  const clearComboCallouts = useCallback(() => {
    comboCalloutTimeoutsRef.current.forEach((t) => clearTimeout(t));
    comboCalloutTimeoutsRef.current = [];
  }, []);

  const scheduleComboCallouts = useCallback(
    (comboName?: string, comboNotation?: string, comboDescription?: string) => {
      if (!comboName || !comboNotation) return;

      clearComboCallouts();
      tenSecondCalledRef.current = false;
      lastBeepSecondRef.current = null;

      const numbers = comboNotation.replace(/-/g, " ");
      const tips = buildTips(comboDescription);
      const tip1 = tips[0];
      const tip2 = tips[1];

      speak(comboName);
      const t1 = setTimeout(() => speak(numbers), 0);
      const tTip1 = tip1 ? setTimeout(() => speak(tip1), 2500) : null;
      const t2 = setTimeout(() => speak(numbers), 5000);
      const tTip2 = tip2 ? setTimeout(() => speak(tip2), 8000) : null;
      const t3 = setTimeout(() => speak(numbers), 10000);
      const t4 = setTimeout(() => speak("keep going"), 15000);

      comboCalloutTimeoutsRef.current = [t1, t2, t3, t4].concat(
        [tTip1, tTip2].filter((v): v is NodeJS.Timeout => Boolean(v))
      );
    },
    [buildTips, clearComboCallouts, speak]
  );

  const playBeep = useCallback(async () => {
    try {
      const sound = beepSoundRef.current;
      if (!sound) return;
      await sound.replayAsync();
    } catch (error) {
      console.error("Beep playback failed", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadBeep = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync({
          uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
        });
        if (isMounted) {
          beepSoundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error("Failed to load beep sound", error);
      }
    };

    loadBeep();

    return () => {
      isMounted = false;
      clearComboCallouts();
      Speech.stop();
      if (beepSoundRef.current) {
        beepSoundRef.current.unloadAsync();
        beepSoundRef.current = null;
      }
    };
  }, [clearComboCallouts]);

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

    speak("Amazing work. Workout complete. You are getting sharper every round.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate("Home");
  }, [addWorkoutToHistory, currentWorkout, currentStreak, longestStreak, navigation, speak, unlockAchievement, unlockedAchievements, workoutHistory]);

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
    if (!isRunning || isPaused) {
      Speech.stop();
      clearComboCallouts();
    }
  }, [clearComboCallouts, isPaused, isRunning]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") {
      clearComboCallouts();
      return;
    }
    if (!combo) return;

    const comboKey = `${currentRound}-${combo.notation}-${combo.name}`;
    if (lastComboKeyRef.current !== comboKey) {
      lastComboKeyRef.current = comboKey;
      scheduleComboCallouts(combo.name, combo.notation, combo.description);
    }
  }, [clearComboCallouts, combo, currentRound, isPaused, isRunning, phase, scheduleComboCallouts]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    if (phase === "rest") {
      if (restSpokenRef.current !== currentRound) {
        restSpokenRef.current = currentRound;
        speak(`Rest. ${restRemaining} seconds`);
      }
    } else {
      restSpokenRef.current = null;
    }
  }, [currentRound, isPaused, isRunning, phase, restRemaining, speak]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "rest") return;
    if (restRemaining === 10) {
      speak("10 seconds, get ready");
    }
  }, [isPaused, isRunning, phase, restRemaining, speak]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "rest") return;
    if (restRemaining <= 5 && restRemaining > 0) {
      if (lastRestBeepSecondRef.current !== restRemaining) {
        lastRestBeepSecondRef.current = restRemaining;
        playBeep();
      }
    } else if (restRemaining > 5) {
      lastRestBeepSecondRef.current = null;
    }
  }, [isPaused, isRunning, phase, playBeep, restRemaining]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") return;
    const secondInMinute = timeRemaining % 60;
    if (secondInMinute === 10 && lastMinuteTenRef.current !== timeRemaining) {
      lastMinuteTenRef.current = timeRemaining;
      speak("10 seconds");
      if (timeRemaining === 10) {
        tenSecondCalledRef.current = true;
      }
    }
    if (timeRemaining === 10 && !tenSecondCalledRef.current) {
      tenSecondCalledRef.current = true;
      // Already spoke above when secondInMinute === 10; keep guard to avoid double.
    }
  }, [isPaused, isRunning, phase, speak, timeRemaining]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") return;
    const secondInMinute = timeRemaining % 60;
    if (secondInMinute <= 5 && secondInMinute > 0) {
      if (lastBeepSecondRef.current !== timeRemaining) {
        lastBeepSecondRef.current = timeRemaining;
        playBeep();
      }
    }
  }, [isPaused, isRunning, phase, playBeep, timeRemaining]);

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
      <LinearGradient colors={["#000000", "#1A0000"]} style={{ flex: 1 }}>
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
    <LinearGradient colors={["#000000", "#000000"]} style={{ flex: 1 }}>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="px-6 py-4">
          <Text className="text-gray-500 text-sm">Round {currentRound} / {totalRounds}</Text>
        </View>

        {/* Main Timer Area */}
        <View className="flex-1 items-center justify-center px-6">
          {/* Phase Indicator */}
          <View className="mb-8">
            <View className="bg-boxing-red/20 px-6 py-2 rounded-full">
              <Text className="text-boxing-red text-base font-bold uppercase tracking-widest">
                {phase === "rest" ? "REST" : "WORK"}
              </Text>
            </View>
          </View>

          {/* Large Timer */}
          <Text className="text-[120px] font-black text-white tracking-tight leading-none mb-12">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>

          {/* Exercise Card */}
          <View className="w-full bg-[#1A1A1A] rounded-2xl p-6 mb-8">
            <Text className="text-white text-2xl font-bold mb-2">{combo?.name ?? "---"}</Text>
            <Text className="text-boxing-red text-lg font-bold mb-3">{combo?.notation ?? "---"}</Text>
            <Text className="text-gray-400 text-sm leading-5 mb-3">
              {combo?.description ?? ""}
            </Text>
            <Text className="text-gray-500 text-sm">
              Next: {combos[(currentComboIndex + 1) % combos.length]?.name ?? "---"}
            </Text>
          </View>

          {/* Pause Button */}
          <Pressable 
            onPress={toggleRunning} 
            className="active:opacity-80"
            style={{ width: 80, height: 80 }}
          >
            <View className="w-20 h-20 bg-boxing-red rounded-full items-center justify-center">
              <View className="flex-row space-x-1">
                {isPaused || !isRunning ? (
                  <View className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
                ) : (
                  <>
                    <View className="w-2 h-8 bg-white rounded-sm" />
                    <View className="w-2 h-8 bg-white rounded-sm" />
                  </>
                )}
              </View>
            </View>
          </Pressable>
        </View>

        {/* Pause Modal Overlay */}
        {isPaused && (
          <View className="absolute inset-0 bg-black/80 items-center justify-center" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View className="bg-[#1A1A1A] rounded-3xl mx-6 w-full max-w-md" style={{ maxWidth: 400 }}>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-6 py-5 border-b border-gray-800">
                <Text className="text-white text-xl font-bold">Paused</Text>
                <Pressable onPress={toggleRunning} hitSlop={8}>
                  <Text className="text-white text-2xl font-light">×</Text>
                </Pressable>
              </View>

              {/* Modal Content */}
              <View className="p-6">
                <Text className="text-gray-400 text-center text-sm mb-6">
                  Watch a quick lesson for {combo?.name ?? "this exercise"}
                </Text>

                {/* YouTube Button */}
                <Pressable onPress={watchLesson} className="active:opacity-90 mb-3">
                  <View className="bg-black rounded-xl py-4 px-6">
                    <Text className="text-white text-center text-base font-bold">
                      Watch lesson on YouTube
                    </Text>
                  </View>
                </Pressable>

                {/* Resume Button */}
                <Pressable onPress={toggleRunning} className="active:opacity-90 mb-3">
                  <View className="bg-black rounded-xl py-4 px-6">
                    <Text className="text-white text-center text-base font-bold">
                      Resume
                    </Text>
                  </View>
                </Pressable>

                {/* Exit Button */}
                <Pressable onPress={endWorkout} className="active:opacity-80">
                  <View className="bg-[#2A2A2A] rounded-xl py-4 px-6">
                    <Text className="text-white text-center text-base font-bold">
                      Exit Workout
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

export default TimerScreen;
