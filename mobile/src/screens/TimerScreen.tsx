import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useUserStore } from "../state/userStore";
import { BoxingLevel } from "../types/workout";
import { checkAchievements } from "../utils/achievements";
import { logWorkoutSession } from "../api/database-service";
import { INTERSTITIAL_AD_UNIT_ID, useInterstitial } from "../lib/ads";
import BannerAdView from "../components/BannerAdView";
import {
  expandForSpeech,
  generateVariations,
  pickDeterministic,
} from "../lib/combo-variations";

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
  const workoutMode = useUserStore((s) => s.workoutMode);
  const boxingLevel = useUserStore((s) => s.boxingLevel);

  const [currentRound, setCurrentRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("work");
  const [timeRemaining, setTimeRemaining] = useState(WORK_DURATION);
  const [restRemaining, setRestRemaining] = useState(REST_DURATION);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);
  const [dynamicComboNotation, setDynamicComboNotation] = useState<string | null>(null);
  const userId = useUserStore((s) => s.userId);

  const comboCalloutTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const lastComboKeyRef = useRef<string | null>(null);
  const lastBeepSecondRef = useRef<number | null>(null);
  const lastMinuteCalloutRef = useRef<number | null>(null);
  const lastRestBeepSecondRef = useRef<number | null>(null);
  const restSpokenRef = useRef<number | null>(null);
  const beepSoundRef = useRef<Audio.Sound | null>(null);
  const isEarlyExitRef = useRef(false);
  // Dynamic-mode scheduling refs. All times are wall-clock ms.
  const roundStartedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef<number>(0);
  const dynamicScheduleRef = useRef<{ notation: string; offsetMs: number }[]>([]);
  const dynamicFillerScheduleRef = useRef<{ speech: string; offsetMs: number }[]>([]);
  const dynamicNextIndexRef = useRef<number>(0);
  const dynamicNextFillerIndexRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [coachVoiceId, setCoachVoiceId] = useState<string | undefined>(undefined);

  const postWorkoutAd = useInterstitial(INTERSTITIAL_AD_UNIT_ID);

  useEffect(() => {
    let cancelled = false;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled) return;
        const enUs = voices.filter((v) => v.language.startsWith("en"));
        const nonDefault = enUs.filter((v) => v.quality !== Speech.VoiceQuality.Default);

        let picked: string | undefined;

        if (Platform.OS === "android") {
          const googleTts = enUs.filter((v) =>
            v.identifier?.toLowerCase().startsWith("com.google.android.tts:"),
          );
          // Google's "Network" voices (identifier ends with `-network`) are
          // neural cloud-rendered and sound dramatically better than local
          // synthesis. They aren't flagged as Enhanced in expo-speech so they
          // get skipped by a quality-only filter. PunchPal is online-only so
          // requiring network for TTS is fine.
          const networkGoogle = googleTts.filter((v) =>
            v.identifier.toLowerCase().includes("-network"),
          );
          const enhancedGoogle = googleTts.filter(
            (v) => v.quality === Speech.VoiceQuality.Enhanced,
          );
          picked =
            networkGoogle.find((v) => v.language === "en-US")?.identifier ??
            networkGoogle[0]?.identifier ??
            enhancedGoogle.find((v) => v.language === "en-US")?.identifier ??
            enhancedGoogle[0]?.identifier ??
            googleTts.find((v) => v.language === "en-US")?.identifier ??
            googleTts[0]?.identifier ??
            nonDefault[0]?.identifier ??
            enUs[0]?.identifier;
        } else {
          // iOS — pick the generic Siri male ("Voice 1") if available, else
          // fall back through the named premium/enhanced male voice list.
          const pickSiriMale = (pool: Speech.Voice[]) =>
            pool.find((v) => {
              const id = v.identifier.toLowerCase();
              return id.includes("siri") && id.includes("_male_");
            })?.identifier;

          const preferOrder = ["Nathan", "Aaron", "Evan", "Tom", "Reed", "Fred", "Daniel"];
          const pickByName = (pool: Speech.Voice[]) => {
            for (const name of preferOrder) {
              const match = pool.find(
                (v) =>
                  v.name.toLowerCase().includes(name.toLowerCase()) ||
                  v.identifier.toLowerCase().includes(name.toLowerCase()),
              );
              if (match) return match.identifier;
            }
            return undefined;
          };

          picked =
            pickSiriMale(nonDefault) ??
            pickByName(nonDefault) ??
            nonDefault[0]?.identifier ??
            pickSiriMale(enUs) ??
            pickByName(enUs);
        }

        setCoachVoiceId(picked);
      })
      .catch(() => {
        // Falls back to platform default voice — same as before.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRounds = currentWorkout?.rounds ?? 1;
  const combos = currentWorkout?.combos ?? [];

  const combo = useMemo(() => combos[currentComboIndex], [combos, currentComboIndex]);

  const formatNotationForSpeech = (notation: string): string =>
    notation
      .split("-")
      .map((part) => {
        const trimmed = part.trim();
        if (/^\d+b$/i.test(trimmed)) {
          return `${trimmed.slice(0, -1)} to the body`;
        }
        return trimmed;
      })
      .join(", ");

  const speak = useCallback(
    (text: string) => {
      Speech.speak(text, {
        language: "en-US",
        voice: coachVoiceId,
        // Android TTS voices have flatter prosody than iOS Siri voices —
        // slowing them a notch noticeably reduces the robotic feel.
        rate: Platform.OS === "android" ? 0.88 : 0.95,
        pitch: 1,
      });
    },
    [coachVoiceId]
  );

  const clearComboCallouts = useCallback(() => {
    comboCalloutTimeoutsRef.current.forEach((t) => clearTimeout(t));
    comboCalloutTimeoutsRef.current = [];
  }, []);

  const scheduleComboCallouts = useCallback(
    (comboName?: string, comboNotation?: string, comboDescription?: string) => {
      if (!comboName || !comboNotation) return;

      clearComboCallouts();
      lastBeepSecondRef.current = null;

      const numbers = formatNotationForSpeech(comboNotation);
      const description = comboDescription?.trim();

      // Initial burst — Expo Speech queues utterances, so these play back-to-back.
      speak(comboName);
      speak(numbers);
      if (description) speak(description);

      // After the intro plays, repeat the notation periodically through the round.
      const t1 = setTimeout(() => speak(numbers), 25000);
      const t2 = setTimeout(() => speak(numbers), 40000);
      const t3 = setTimeout(() => speak("keep going"), 55000);

      comboCalloutTimeoutsRef.current = [t1, t2, t3];
    },
    [clearComboCallouts, speak]
  );

  const cadenceFor = (level: BoxingLevel | null): number => {
    if (level === "advanced") return 18;
    if (level === "beginner") return 45;
    return 28;
  };

  const TACTICAL_FILLERS = [
    "reset, circle out",
    "keep your guard up",
    "stay loose",
  ] as const;
  const MOTIVATIONAL_FILLERS = [
    "stay sharp",
    "halfway, push",
    "finish strong",
  ] as const;

  const scheduleDynamicFromIndex = useCallback(
    (comboStartIdx: number, fillerStartIdx: number) => {
      const startedAt = roundStartedAtRef.current;
      if (startedAt == null) return;

      const now = Date.now();
      const pausedAccum = pausedAccumMsRef.current;

      const scheduleEvent = (offsetMs: number, fn: () => void) => {
        const target = startedAt + offsetMs + pausedAccum;
        const delay = Math.max(0, target - now);
        const id = setTimeout(() => {
          if (!isRunningRef.current || isPausedRef.current) return;
          fn();
        }, delay);
        comboCalloutTimeoutsRef.current.push(id as unknown as NodeJS.Timeout);
      };

      const combos = dynamicScheduleRef.current;
      const fillers = dynamicFillerScheduleRef.current;

      for (let i = comboStartIdx; i < combos.length; i++) {
        const { notation, offsetMs } = combos[i];
        scheduleEvent(offsetMs, () => {
          dynamicNextIndexRef.current = i + 1;
          setDynamicComboNotation(notation);
          speak(expandForSpeech(notation));
        });
      }

      for (let j = fillerStartIdx; j < fillers.length; j++) {
        const { speech, offsetMs } = fillers[j];
        scheduleEvent(offsetMs, () => {
          dynamicNextFillerIndexRef.current = j + 1;
          speak(speech);
        });
      }
    },
    [speak]
  );

  const scheduleDynamicCallouts = useCallback(
    (anchorNotation: string) => {
      if (!anchorNotation) return;

      clearComboCallouts();
      Speech.stop();
      lastBeepSecondRef.current = null;

      const cadence = cadenceFor(boxingLevel);
      // Anchor fires at t=4s. We want the last combo to finish before the 10s
      // end-of-round buffer at t=170s. Allowing ~5s per utterance, the latest
      // safe start is t=4 + N*cadence ≤ 165, so N ≤ floor(161/cadence).
      const numCalls = Math.min(9, Math.floor(161 / cadence) + 1);
      const variations = generateVariations(anchorNotation, numCalls - 1);
      const combosList = [anchorNotation, ...variations];

      const startedAt = Date.now();
      roundStartedAtRef.current = startedAt;
      pausedAccumMsRef.current = 0;
      pausedAtRef.current = null;
      dynamicNextIndexRef.current = 0;
      dynamicNextFillerIndexRef.current = 0;

      const schedule = combosList.map((notation, i) => ({
        notation,
        offsetMs: (i * cadence + 4) * 1000,
      }));
      dynamicScheduleRef.current = schedule;

      // Tactical filler in the first gap (between anchor and variation 1),
      // motivational at ~120s. Both queue via Speech.speak — if a combo is
      // still being uttered when a filler fires, Expo Speech queues them.
      const tacticalOffsetMs = (Math.floor(cadence * 0.6) + 4) * 1000;
      const motivationalOffsetMs = 122 * 1000;
      const fillerSchedule = [
        {
          speech: pickDeterministic(TACTICAL_FILLERS, `tactical-${anchorNotation}`),
          offsetMs: tacticalOffsetMs,
        },
        {
          speech: pickDeterministic(MOTIVATIONAL_FILLERS, `motivational-${anchorNotation}`),
          offsetMs: motivationalOffsetMs,
        },
      ];
      dynamicFillerScheduleRef.current = fillerSchedule;

      // Show the anchor immediately on the card so the t=4s utterance lines up
      // with the visual.
      setDynamicComboNotation(anchorNotation);

      scheduleDynamicFromIndex(0, 0);
    },
    [boxingLevel, clearComboCallouts, scheduleDynamicFromIndex]
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

    speak("Workout complete. Every round, you're getting sharper.");
    speak("Rate how it felt — it helps me dial in the next workout for you.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    isEarlyExitRef.current = false;
    setFinishedAt(completedAt);
    setShowRating(true);
    setIsRunning(false);
  }, [addWorkoutToHistory, currentWorkout, currentStreak, longestStreak, speak, unlockAchievement, unlockedAchievements, workoutHistory]);

  const exitToHome = useCallback(() => {
    const shouldShowAd = !isEarlyExitRef.current;
    if (shouldShowAd) {
      postWorkoutAd.show(() => navigation.goBack());
    } else {
      navigation.goBack();
    }
  }, [navigation, postWorkoutAd]);

  const submitRating = useCallback(
    async (rating: 1 | 2 | 3) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const completedAt = finishedAt ?? new Date();
      if (currentWorkout && userId) {
        // Fire-and-forget — UX shouldn't wait on the network.
        logWorkoutSession({
          userId,
          workoutName: currentWorkout.name,
          difficulty: currentWorkout.difficulty,
          duration: currentWorkout.duration,
          rounds: currentWorkout.rounds,
          completedAt: completedAt.toISOString(),
          durationMinutes: Math.round(currentWorkout.duration),
          combosAttempted: currentWorkout.combos.length,
          combosCompleted: currentWorkout.combos.length,
          accuracy: 0,
          difficultyRating: rating,
        }).catch(() => {
          // Local state already updated; cloud sync failure is non-blocking.
        });
      }
      setShowRating(false);
      postWorkoutAd.show(() => navigation.goBack());
    },
    [currentWorkout, finishedAt, navigation, postWorkoutAd, userId]
  );

  const skipRating = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const completedAt = finishedAt ?? new Date();
    if (currentWorkout && userId) {
      logWorkoutSession({
        userId,
        workoutName: currentWorkout.name,
        difficulty: currentWorkout.difficulty,
        duration: currentWorkout.duration,
        rounds: currentWorkout.rounds,
        completedAt: completedAt.toISOString(),
        durationMinutes: Math.round(currentWorkout.duration),
        combosAttempted: currentWorkout.combos.length,
        combosCompleted: currentWorkout.combos.length,
        accuracy: 0,
      }).catch(() => {});
    }
    setShowRating(false);
    postWorkoutAd.show(() => navigation.goBack());
  }, [currentWorkout, finishedAt, navigation, postWorkoutAd, userId]);

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

  // Keep refs in lockstep with state so the chained setTimeout callbacks
  // (which capture refs, not state snapshots) see live values.
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    isPausedRef.current = isPaused;
    // On resume in Dynamic mode, account for elapsed pause time and re-schedule
    // remaining combos / fillers against the offset wall-clock.
    if (
      workoutMode === "dynamic" &&
      !isPaused &&
      isRunning &&
      phase === "work" &&
      pausedAtRef.current != null
    ) {
      pausedAccumMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
      scheduleDynamicFromIndex(
        dynamicNextIndexRef.current,
        dynamicNextFillerIndexRef.current
      );
    }
  }, [isPaused, isRunning, phase, scheduleDynamicFromIndex, workoutMode]);

  useEffect(() => {
    if (!isRunning || isPaused) {
      if (!showRating) {
        Speech.stop();
      }
      clearComboCallouts();
    }
  }, [clearComboCallouts, isPaused, isRunning, showRating]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") {
      clearComboCallouts();
      return;
    }
    if (!combo) return;

    const comboKey = `${currentRound}-${combo.notation}-${combo.name}-${workoutMode}`;
    if (lastComboKeyRef.current !== comboKey) {
      lastComboKeyRef.current = comboKey;
      if (workoutMode === "dynamic") {
        scheduleDynamicCallouts(combo.notation);
      } else {
        setDynamicComboNotation(null);
        scheduleComboCallouts(combo.name, combo.notation, combo.description);
      }
    }
  }, [clearComboCallouts, combo, currentRound, isPaused, isRunning, phase, scheduleComboCallouts, scheduleDynamicCallouts, workoutMode]);

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
    if (lastMinuteCalloutRef.current === timeRemaining) return;
    if (timeRemaining === 120) {
      lastMinuteCalloutRef.current = timeRemaining;
      speak("2 minutes left");
    } else if (timeRemaining === 60) {
      lastMinuteCalloutRef.current = timeRemaining;
      speak("1 minute left");
    } else if (timeRemaining === 10) {
      lastMinuteCalloutRef.current = timeRemaining;
      speak("10 seconds");
    }
  }, [isPaused, isRunning, phase, speak, timeRemaining]);

  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") return;
    if (timeRemaining <= 5 && timeRemaining > 0) {
      if (lastBeepSecondRef.current !== timeRemaining) {
        lastBeepSecondRef.current = timeRemaining;
        playBeep();
      }
    }
  }, [isPaused, isRunning, phase, playBeep, timeRemaining]);

  // One combo per round — no within-round cycling. The combo advances only
  // when a new round starts (handled in startNextRound).

  const toggleRunning = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!isRunning) {
      setIsRunning(true);
      setIsPaused(false);
      return;
    }
    const enteringPause = !isPaused;
    if (enteringPause) {
      pausedAtRef.current = Date.now();
    } else if (workoutMode === "classic") {
      // Classic: nudge the comboKey effect to re-fire the standard 25/40/55s
      // schedule from the top. Dynamic re-anchoring is handled in the
      // isPaused sync useEffect.
      lastComboKeyRef.current = null;
    }
    setIsPaused(enteringPause);
  };

  const endWorkout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Speech.stop();
    clearComboCallouts();
    setIsRunning(false);
    setIsPaused(false);
    isEarlyExitRef.current = true;
    setFinishedAt(new Date());
    setShowRating(true);
    speak("Workout ended. Showing up is half the fight — every rep is in the bank.");
    speak("Rate how it felt — it helps me dial in the next workout for you.");
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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 py-3 flex-row items-center justify-between">
          <Text className="text-boxing-gold text-xs font-bold uppercase tracking-widest">
            {currentWorkout.difficulty}
          </Text>
          <Text className="text-gray-500 text-sm">Round {currentRound} / {totalRounds}</Text>
        </View>

        {/* Main Timer Area */}
        <View className="flex-1 items-center justify-center px-6">
          {/* Phase Indicator */}
          <View className="mb-5">
            <View className="bg-boxing-red/20 px-6 py-2 rounded-full">
              <Text className="text-boxing-red text-base font-bold uppercase tracking-widest">
                {phase === "rest" ? "REST" : "WORK"}
              </Text>
            </View>
          </View>

          {/* Large Timer */}
          <Text
            className="text-white font-black tracking-tight leading-none mb-6"
            style={{ fontSize: 96 }}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>

          {/* Exercise Card — replaced by REST banner during rest phase */}
          {phase === "rest" ? (
            <View className="w-full items-center justify-center mb-6 py-8">
              <Text
                className="text-boxing-red font-black tracking-widest"
                style={{ fontSize: 96, lineHeight: 100 }}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                REST
              </Text>
              <Text className="text-gray-400 text-sm mt-2" numberOfLines={1}>
                Next: {combo?.name ?? "---"}
              </Text>
            </View>
          ) : workoutMode === "dynamic" ? (
            <View className="w-full bg-[#1A1A1A] rounded-2xl p-5 mb-6">
              <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2" numberOfLines={1}>
                Combo
              </Text>
              <Text
                className="text-boxing-red font-black tracking-wider mb-3"
                style={{ fontSize: 48, lineHeight: 52 }}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {dynamicComboNotation ?? combo?.notation ?? "---"}
              </Text>
              <Text className="text-gray-500 text-xs" numberOfLines={1}>
                Next round: {combos[(currentComboIndex + 1) % combos.length]?.name ?? "---"}
              </Text>
            </View>
          ) : (
            <View className="w-full bg-[#1A1A1A] rounded-2xl p-5 mb-6">
              <Text className="text-white text-xl font-bold mb-2" numberOfLines={1}>
                {combo?.name ?? "---"}
              </Text>
              <Text
                className="text-boxing-red font-black tracking-wider mb-3"
                style={{ fontSize: 48, lineHeight: 52 }}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {combo?.notation ?? "---"}
              </Text>
              <Text className="text-gray-300 text-base leading-6 mb-3">
                {combo?.description ?? ""}
              </Text>
              <Text className="text-gray-500 text-xs" numberOfLines={1}>
                Next: {combos[(currentComboIndex + 1) % combos.length]?.name ?? "---"}
              </Text>
            </View>
          )}

          {/* Pause Button */}
          <Pressable
            onPress={toggleRunning}
            className="active:opacity-80"
            style={{ width: 72, height: 72 }}
          >
            <View className="w-[72px] h-[72px] bg-boxing-red rounded-full items-center justify-center">
              <View className="flex-row space-x-1">
                {isPaused || !isRunning ? (
                  <View className="w-0 h-0 border-l-[18px] border-l-white border-t-[11px] border-t-transparent border-b-[11px] border-b-transparent ml-1" />
                ) : (
                  <>
                    <View className="w-2 h-7 bg-white rounded-sm" />
                    <View className="w-2 h-7 bg-white rounded-sm" />
                  </>
                )}
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BannerAdView />
      </View>

        {/* Post-Workout Rating Modal */}
        {showRating && (
          <View
            className="absolute inset-0 bg-black/90 items-center justify-center px-6"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          >
            <View className="bg-[#1A1A1A] rounded-3xl w-full" style={{ maxWidth: 400 }}>
              <View className="px-6 py-5 border-b border-gray-800">
                <Text className="text-white text-xl font-bold text-center">
                  Workout Complete
                </Text>
                <Text className="text-gray-400 text-sm text-center mt-1">
                  How was that?
                </Text>
              </View>
              <View className="p-6 space-y-3">
                <Pressable onPress={() => submitRating(1)} className="active:opacity-90">
                  <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-gold">
                    <Text className="text-white text-center text-base font-bold">
                      Too Easy
                    </Text>
                    <Text className="text-gray-400 text-center text-xs mt-1">
                      Push me harder next time
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => submitRating(2)} className="active:opacity-90">
                  <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-red">
                    <Text className="text-white text-center text-base font-bold">
                      Just Right
                    </Text>
                    <Text className="text-gray-400 text-center text-xs mt-1">
                      Challenging but doable
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => submitRating(3)} className="active:opacity-90">
                  <View className="bg-black rounded-xl py-4 px-6 border-2 border-gray-600">
                    <Text className="text-white text-center text-base font-bold">
                      Too Hard
                    </Text>
                    <Text className="text-gray-400 text-center text-xs mt-1">
                      Drop the complexity
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={skipRating} className="active:opacity-80 pt-2">
                  <Text className="text-gray-500 text-center text-sm">Skip</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Pause Modal Overlay */}
        {isPaused && (
          <View className="absolute inset-0 bg-black/80 items-center justify-center" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View className="bg-[#1A1A1A] rounded-3xl mx-6 w-full max-w-md" style={{ maxWidth: 400 }}>
              {/* Modal Header */}
              <View className="px-6 py-5 border-b border-gray-800">
                <Text className="text-white text-xl font-bold">Paused</Text>
              </View>

              {/* Modal Content */}
              <View className="p-6">
                <Text className="text-gray-400 text-center text-sm mb-6">
                  Watch a quick lesson for {combo?.name ?? "this exercise"}
                </Text>

                {/* YouTube Button */}
                <Pressable onPress={watchLesson} className="active:opacity-90 mb-3">
                  <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-red">
                    <Text className="text-white text-center text-base font-bold">
                      Watch lesson on YouTube
                    </Text>
                  </View>
                </Pressable>

                {/* Resume Button */}
                <Pressable onPress={toggleRunning} className="active:opacity-90 mb-3">
                  <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-gold">
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
    </LinearGradient>
  );
}

export default TimerScreen;
