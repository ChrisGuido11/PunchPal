import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useKeepAwake } from "expo-keep-awake";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useUserStore } from "../state/userStore";
import { BoxingLevel, Round } from "../types/workout";
import { checkAchievements } from "../utils/achievements";
import {
  logWorkoutSession,
  recordComboProgressForSession,
  upsertUserStats,
} from "../api/database-service";
import { INTERSTITIAL_AD_UNIT_ID, useInterstitial } from "../lib/ads";
import BannerAdView from "../components/BannerAdView";
import LevelUpModal from "../components/LevelUpModal";
import {
  estimateSpeechDuration,
  expandForDisplay,
  expandForSpeech,
  generateVariations,
} from "../lib/combo-variations";
import {
  computeProgression,
  type RatingOutcome,
} from "../lib/progression";
import {
  startWorkoutBackgroundTask,
  stopWorkoutBackgroundTask,
  updateWorkoutBackgroundTask,
} from "../lib/background-task";

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Timer">;

const WORK_DURATION = 180; // 3 minutes
const REST_DURATION = 60; // 1 minute
const END_OF_ROUND_WARN_MS = 170_000;
const END_OF_ROUND_END_MS = 180_000;
const LATEST_DYNAMIC_FIRE_MS = 165_000;
const REMINDER_WINDOW_START_MS = 30_000;
const REMINDER_WINDOW_END_MS = 160_000;
const DESCRIPTION_OFFSET_MS = 5_000;
const ANCHOR_REANNOUNCE_PRIMARY_MS = 90_000;
const ANCHOR_REANNOUNCE_SECONDARY_MS = 153_000;
// Post-speech silence before next combo fires. Reduced from 4000ms after user
// feedback that 4s felt sluggish — actual silence is `DYNAMIC_GAP_MS - speech
// overrun` which is ~1.5–2s effective at 2500ms (real Siri speech is slower
// than our estimator's 400ms/word baseline).
const DYNAMIC_GAP_MS = 2_500;
const MAX_DYNAMIC_CALLS = 40;

type Phase = "work" | "rest";

function tierFromLevelProgress(
  level: BoxingLevel | null,
  progress: number
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
  const lvl: BoxingLevel = level ?? "beginner";
  const clamped = Math.max(0, Math.min(100, progress));
  const sub = clamped <= 33 ? 0 : clamped <= 66 ? 1 : 2;
  const base = lvl === "beginner" ? 1 : lvl === "intermediate" ? 4 : 7;
  return (base + sub) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

function ratingToOutcome(rating: 1 | 2 | 3): RatingOutcome {
  if (rating === 1) return "too_easy";
  if (rating === 2) return "just_right";
  return "too_hard";
}

// Force a balanced two-line wrap by exposing exactly one break opportunity at
// the midpoint of the string. Hard \n breaks adjustsFontSizeToFit, so instead
// we leave only one breakable character: convert other spaces to U+00A0
// (non-breaking space), other hyphens to U+2011 (non-breaking hyphen — same
// visual as a regular hyphen), and insert U+200B (zero-width space) after the
// chosen break point. RN's wrap then has exactly one option, and autoshrink
// computes fit normally against balanced lines.
function balancedTwoLineWrap(s: string): string {
  if (s.length <= 22) return s;
  const mid = Math.floor(s.length / 2);
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 1; i < s.length - 1; i++) {
    const ch = s[i];
    if (ch !== "-" && ch !== " ") continue;
    const dist = Math.abs(i - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return s;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === " ") {
      out += i === bestIdx ? " " : "\u00A0";
    } else if (ch === "-") {
      out += i === bestIdx ? "-\u200B" : "\u2011";
    } else {
      out += ch;
    }
  }
  return out;
}

function TimerScreen({ navigation }: Props) {
  useKeepAwake();
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
  const userId = useUserStore((s) => s.userId);
  const nextLevelProgress = useUserStore((s) => s.nextLevelProgress);
  const levelCapStayingSince = useUserStore((s) => s.levelCapStayingSince);
  const levelCapTooEasyCountSinceStay = useUserStore(
    (s) => s.levelCapTooEasyCountSinceStay
  );
  const demotionWindow = useUserStore((s) => s.demotionWindow);
  const applyProgressionResult = useUserStore(
    (s) => s.applyProgressionResult
  );
  const pushComboSignatures = useUserStore((s) => s.pushComboSignatures);
  const advanceLevel = useUserStore((s) => s.advanceLevel);
  const setLevelCapStaying = useUserStore((s) => s.setLevelCapStaying);

  const [currentRound, setCurrentRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("work");
  const [timeRemaining, setTimeRemaining] = useState(WORK_DURATION);
  const [restRemaining, setRestRemaining] = useState(REST_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);
  const [dynamicNotation, setDynamicNotation] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [pendingAdvanceLevel, setPendingAdvanceLevel] = useState<
    "intermediate" | "advanced" | null
  >(null);
  const [totalElapsedSec, setTotalElapsedSec] = useState(0);

  const totalRounds = currentWorkout?.rounds.length ?? 0;
  const rounds = currentWorkout?.rounds ?? [];
  const currentRoundData: Round | undefined = useMemo(
    () => rounds[currentRound - 1],
    [rounds, currentRound]
  );
  const anchor = currentRoundData?.anchorCombo;

  // Workout-wide timing (independent of per-round refs below). Set on first
  // play; paused-time accumulates across all pauses so the displayed total is
  // active workout time, not wall-clock since start.
  const workoutStartedAtRef = useRef<number | null>(null);
  const workoutPausedAtRef = useRef<number | null>(null);
  const workoutPausedAccumMsRef = useRef<number>(0);

  // Scheduling refs (wall-clock-anchored).
  const roundStartedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef<number>(0);
  // Rest-phase wall-clock anchor (parallel to work above).
  const restStartedAtRef = useRef<number | null>(null);
  const restPausedAtRef = useRef<number | null>(null);
  const restPausedAccumMsRef = useRef<number>(0);
  const scheduleTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const lastBeepSecondRef = useRef<number | null>(null);
  const lastMinuteCalloutRef = useRef<number | null>(null);
  const lastRestBeepSecondRef = useRef<number | null>(null);
  const restSpokenRef = useRef<number | null>(null);
  const beepSoundRef = useRef<Audio.Sound | null>(null);
  const isEarlyExitRef = useRef(false);
  const lastScheduledRoundKeyRef = useRef<string | null>(null);

  // Classic-mode reminder tracking.
  const classicNextReminderIdxRef = useRef<number>(0);
  // Fires once per workout: heads-up that the info icon shows the description.
  const infoHintPlayedRef = useRef<boolean>(false);
  // Per-workout Skip Combo press count (Phase 3). Passed to logWorkoutSession
  // so we can correlate skip rate with workout difficulty + adaptive signals.
  const skipCountRef = useRef<number>(0);

  // Dynamic-mode hybrid scheduler state.
  const dynamicComboListRef = useRef<{ notation: string; speech: string }[]>(
    []
  );
  const dynamicNextIdxRef = useRef<number>(0);
  const dynamicPrimaryHandleRef = useRef<NodeJS.Timeout | null>(null);
  const dynamicPrimaryTargetTimeRef = useRef<number | null>(null);
  const dynamicPrimaryFiredRef = useRef<boolean>(false);

  const [coachVoiceId, setCoachVoiceId] = useState<string | undefined>(undefined);

  const postWorkoutAd = useInterstitial(INTERSTITIAL_AD_UNIT_ID);

  // Combo-card pulse animation.
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const pulseCard = useCallback(() => {
    cardScale.value = withSequence(
      withTiming(1.03, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );
  }, [cardScale]);

  // === Voice selection (preserved from prior implementation) ===

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
        // Falls back to platform default voice.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // === Beep sound ===

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
      clearAllTimeouts();
      Speech.stop();
      if (beepSoundRef.current) {
        beepSoundRef.current.unloadAsync();
        beepSoundRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = useCallback(
    (text: string, options: { onDone?: () => void } = {}) => {
      Speech.speak(text, {
        language: "en-US",
        voice: coachVoiceId,
        rate: Platform.OS === "android" ? 0.88 : 0.95,
        pitch: 1,
        onDone: options.onDone,
      });
    },
    [coachVoiceId]
  );

  // === Schedule plumbing ===

  function clearAllTimeouts() {
    scheduleTimeoutsRef.current.forEach((t) => clearTimeout(t));
    scheduleTimeoutsRef.current = [];
    if (dynamicPrimaryHandleRef.current) {
      clearTimeout(dynamicPrimaryHandleRef.current);
      dynamicPrimaryHandleRef.current = null;
    }
    dynamicPrimaryTargetTimeRef.current = null;
    dynamicPrimaryFiredRef.current = false;
  }

  const scheduleAt = useCallback((offsetMs: number, fn: () => void) => {
    const started = roundStartedAtRef.current;
    if (started == null) return;
    const target = started + offsetMs + pausedAccumMsRef.current;
    const delay = Math.max(0, target - Date.now());
    const id = setTimeout(() => {
      if (!isRunningRef.current || isPausedRef.current) return;
      fn();
    }, delay);
    scheduleTimeoutsRef.current.push(id as unknown as NodeJS.Timeout);
  }, []);

  // === Classic scheduler ===

  const distributeReminderOffsets = (count: number): number[] => {
    if (count <= 0) return [];
    const span = REMINDER_WINDOW_END_MS - REMINDER_WINDOW_START_MS; // 130s
    const step = span / (count + 1);
    return Array.from({ length: count }, (_, i) =>
      Math.round(REMINDER_WINDOW_START_MS + step * (i + 1))
    );
  };

  const scheduleClassicRound = useCallback(
    (round: Round, fromReminderIdx: number = 0) => {
      const anchorSpeech = round.anchorCombo.expandedSpeech;
      const description = round.classicDescription;
      const reminders = round.classicReminders;
      const offsets = distributeReminderOffsets(reminders.length);

      // Anchor speech immediately (no delay) ONLY when fresh round start.
      if (fromReminderIdx === 0) {
        scheduleAt(0, () => {
          pulseCard();
          speak(anchorSpeech);
        });
        if (description) {
          scheduleAt(DESCRIPTION_OFFSET_MS, () => speak(description));
          // One-time heads-up that they can re-read the description via the
          // info icon. Fires once per workout, after the description plays.
          if (!infoHintPlayedRef.current) {
            infoHintPlayedRef.current = true;
            scheduleAt(DESCRIPTION_OFFSET_MS + 14_000, () => {
              speak("Tap the info icon up top if you need a recap.");
            });
          }
        }
      }

      // Distribute reminders.
      for (let i = fromReminderIdx; i < reminders.length; i++) {
        const offset = offsets[i];
        const reminder = reminders[i];
        scheduleAt(offset, () => {
          classicNextReminderIdxRef.current = i + 1;
          speak(reminder.speech);
        });
      }

      // End-of-round bells.
      scheduleAt(END_OF_ROUND_WARN_MS, () => {
        playBeep();
        speak("ten seconds");
      });
      scheduleAt(END_OF_ROUND_END_MS, () => {
        playBeep();
      });
    },
    [pulseCard, scheduleAt, speak, playBeep]
  );

  // === Dynamic scheduler (hybrid gap-based per v5 §5.9) ===

  const buildDynamicComboList = useCallback(
    (round: Round, tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => {
      const anchorSpeech = round.anchorCombo.expandedSpeech;
      const anchorEstMs = estimateSpeechDuration(
        anchorSpeech,
        Platform.OS === "android" ? "android" : "ios"
      );
      const perCallMs = anchorEstMs + DYNAMIC_GAP_MS;
      const numCallsRaw = Math.floor(LATEST_DYNAMIC_FIRE_MS / perCallMs);
      const numCalls = Math.max(1, Math.min(MAX_DYNAMIC_CALLS, numCallsRaw));

      const variations = generateVariations(
        round.anchorCombo.notation,
        numCalls - 1,
        tier
      );

      const combos: { notation: string; speech: string }[] = [
        {
          notation: round.anchorCombo.notation,
          speech: anchorSpeech,
        },
      ];
      for (const v of variations) {
        combos.push({
          notation: v,
          speech: expandForSpeech(v),
        });
      }

      // Anchor reannouncements: find the slots whose expected fire time is
      // closest to t=90s and t=153s and overwrite with the anchor.
      const expectedFireTimes = combos.map((_, i) => i * perCallMs);
      const replaceSlot = (targetMs: number) => {
        if (combos.length < 2) return;
        let bestIdx = -1;
        let bestDist = Infinity;
        // Don't replace slot 0 (it's already the anchor).
        for (let i = 1; i < expectedFireTimes.length; i++) {
          const d = Math.abs(expectedFireTimes[i] - targetMs);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx > 0) {
          combos[bestIdx] = {
            notation: round.anchorCombo.notation,
            speech: anchorSpeech,
          };
        }
      };
      replaceSlot(ANCHOR_REANNOUNCE_PRIMARY_MS);
      replaceSlot(ANCHOR_REANNOUNCE_SECONDARY_MS);

      return combos;
    },
    []
  );

  const fireDynamicCombo = useCallback(
    (idx: number) => {
      const combos = dynamicComboListRef.current;
      if (combos.length === 0) return;
      const started = roundStartedAtRef.current;
      if (started == null) return;
      const elapsed = Date.now() - started - pausedAccumMsRef.current;
      if (elapsed > LATEST_DYNAMIC_FIRE_MS) return;

      // Cycle through the variation pool. Termination is wall-clock based
      // (above); small anchors (e.g. "1-2" yields ~5 variations) need to
      // recycle to fill the 180s round per the Shadow Boxing pad-work pattern.
      const effectiveIdx = idx % combos.length;
      const combo = combos[effectiveIdx];
      dynamicNextIdxRef.current = idx;
      setDynamicNotation(combo.notation);
      pulseCard();

      const platform = Platform.OS === "android" ? "android" : "ios";
      const estimated = estimateSpeechDuration(combo.speech, platform);
      const targetTime = Date.now() + estimated + DYNAMIC_GAP_MS;

      // Reset primary-timer bookkeeping for this fire.
      if (dynamicPrimaryHandleRef.current) {
        clearTimeout(dynamicPrimaryHandleRef.current);
      }
      dynamicPrimaryFiredRef.current = false;
      dynamicPrimaryTargetTimeRef.current = targetTime;

      const advance = () => {
        if (!isRunningRef.current || isPausedRef.current) return;
        dynamicPrimaryFiredRef.current = true;
        fireDynamicCombo(idx + 1);
      };

      const handle = setTimeout(advance, estimated + DYNAMIC_GAP_MS);
      dynamicPrimaryHandleRef.current = handle;
      scheduleTimeoutsRef.current.push(handle as unknown as NodeJS.Timeout);

      speak(combo.speech, {
        onDone: () => {
          if (!isRunningRef.current || isPausedRef.current) return;
          // If onDone fires before the primary timer's target, the primary
          // will fire on schedule — the natural gap is (estimated+4000) -
          // actualDuration, which is ≥ 4s for under-estimates. No-op.
          if (Date.now() < (dynamicPrimaryTargetTimeRef.current ?? 0)) return;
          // onDone fired late. If the primary already fired, the next combo
          // is already speaking — accept the slight overlap.
          if (dynamicPrimaryFiredRef.current) return;
          // Primary hasn't fired yet (rare; would require a 8s+ delay
          // between actual speech end and the primary). Cancel and force a
          // clean 4s gap from now.
          if (dynamicPrimaryHandleRef.current) {
            clearTimeout(dynamicPrimaryHandleRef.current);
            dynamicPrimaryHandleRef.current = null;
          }
          dynamicPrimaryTargetTimeRef.current = null;
          const handle2 = setTimeout(advance, DYNAMIC_GAP_MS);
          dynamicPrimaryHandleRef.current = handle2;
          scheduleTimeoutsRef.current.push(
            handle2 as unknown as NodeJS.Timeout
          );
        },
      });
    },
    [pulseCard, speak]
  );

  const scheduleDynamicRound = useCallback(
    (round: Round, fromIdx: number = 0) => {
      const tier = tierFromLevelProgress(boxingLevel, nextLevelProgress);
      const combos = buildDynamicComboList(round, tier);
      dynamicComboListRef.current = combos;

      // End-of-round bells fire on absolute schedule regardless of combo loop.
      scheduleAt(END_OF_ROUND_WARN_MS, () => {
        playBeep();
        speak("ten seconds");
      });
      scheduleAt(END_OF_ROUND_END_MS, () => {
        playBeep();
      });

      // Kick off the gap-based loop at the desired index.
      setDynamicNotation(combos[fromIdx]?.notation ?? null);
      fireDynamicCombo(fromIdx);
    },
    [
      boxingLevel,
      nextLevelProgress,
      buildDynamicComboList,
      fireDynamicCombo,
      playBeep,
      scheduleAt,
      speak,
    ]
  );

  // === Skip Combo (Phase 3) ===
  //
  // In dynamic mode, lets the user dismiss the current combo if it isn't
  // landing. Records the dismissed combo as TOO HARD (rating=3) via the
  // existing per-combo RPC so it feeds the same struggle-list pipeline that
  // future workouts read from — over a few uses, the system will stop
  // generating combos the user keeps skipping. Also increments a per-session
  // counter for analytics. Classic-mode rounds have a single anchor and
  // already have the round-skip media control, so this button only shows
  // in dynamic mode.
  const handleSkipCombo = useCallback(() => {
    if (workoutMode !== "dynamic") return;
    if (!isRunning || isPaused || phase !== "work") return;
    const combos = dynamicComboListRef.current;
    if (combos.length === 0) return;
    const idx = dynamicNextIdxRef.current;
    const current = combos[idx % combos.length];
    if (!current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipCountRef.current += 1;

    if (userId) {
      recordComboProgressForSession(
        userId,
        [{ notation: current.notation, name: currentWorkout?.name }],
        3
      ).catch(() => {});
    }

    // Cut the current TTS + cancel the pending advance timer, then fire the
    // next variation immediately. The wall-clock end-of-round bells were
    // scheduled separately and remain unaffected.
    Speech.stop();
    if (dynamicPrimaryHandleRef.current) {
      clearTimeout(dynamicPrimaryHandleRef.current);
      dynamicPrimaryHandleRef.current = null;
    }
    fireDynamicCombo(idx + 1);
  }, [
    currentWorkout,
    fireDynamicCombo,
    isPaused,
    isRunning,
    phase,
    userId,
    workoutMode,
  ]);

  // === Round-start orchestration ===

  const startWorkSchedule = useCallback(
    (round: Round) => {
      clearAllTimeouts();
      Speech.stop();
      lastBeepSecondRef.current = null;
      classicNextReminderIdxRef.current = 0;
      dynamicNextIdxRef.current = 0;
      pausedAccumMsRef.current = 0;
      pausedAtRef.current = null;
      roundStartedAtRef.current = Date.now();

      // Round-start bell.
      playBeep();

      if (workoutMode === "dynamic") {
        scheduleDynamicRound(round);
      } else {
        scheduleClassicRound(round);
      }
    },
    [workoutMode, scheduleDynamicRound, scheduleClassicRound, playBeep]
  );

  // Keep refs in sync with state for setTimeout callbacks.
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Re-anchor schedule on resume from pause.
  useEffect(() => {
    if (
      !isPaused &&
      isRunning &&
      phase === "work" &&
      pausedAtRef.current != null
    ) {
      const pauseDuration = Date.now() - pausedAtRef.current;
      pausedAccumMsRef.current += pauseDuration;
      pausedAtRef.current = null;

      const round = currentRoundData;
      if (!round) return;
      // Wipe pending timeouts and re-schedule remaining work.
      clearAllTimeouts();

      const elapsed =
        Date.now() - (roundStartedAtRef.current ?? Date.now()) - pausedAccumMsRef.current;

      if (workoutMode === "dynamic") {
        // Re-fire the current combo from start (per v5 §5.9).
        // End-of-round bells re-armed.
        if (elapsed < END_OF_ROUND_WARN_MS) {
          scheduleAt(END_OF_ROUND_WARN_MS, () => {
            playBeep();
            speak("ten seconds");
          });
        }
        if (elapsed < END_OF_ROUND_END_MS) {
          scheduleAt(END_OF_ROUND_END_MS, () => {
            playBeep();
          });
        }
        if (elapsed < LATEST_DYNAMIC_FIRE_MS) {
          fireDynamicCombo(dynamicNextIdxRef.current);
        }
      } else {
        scheduleClassicRound(round, classicNextReminderIdxRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, isRunning, phase, workoutMode]);

  // Round-key effect: start a new schedule whenever (round, mode) changes
  // and we're in work phase + running.
  useEffect(() => {
    if (!isRunning || isPaused || phase !== "work") return;
    if (!currentRoundData) return;
    const key = `${currentRound}-${workoutMode}-${currentRoundData.anchorCombo.notation}`;
    if (lastScheduledRoundKeyRef.current === key) return;
    lastScheduledRoundKeyRef.current = key;
    startWorkSchedule(currentRoundData);
  }, [
    currentRound,
    currentRoundData,
    isPaused,
    isRunning,
    phase,
    workoutMode,
    startWorkSchedule,
  ]);

  // Stop speech + timeouts when not running.
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (!showRating) {
        Speech.stop();
      }
      clearAllTimeouts();
    }
  }, [isPaused, isRunning, showRating]);

  // === AppState foreground re-anchor ===

  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next !== "active") return;
      if (!isRunningRef.current || isPausedRef.current) return;
      if (phase !== "work") return;
      const round = currentRoundData;
      if (!round) return;
      const started = roundStartedAtRef.current;
      if (started == null) return;
      const elapsed = Date.now() - started - pausedAccumMsRef.current;
      if (elapsed > END_OF_ROUND_END_MS) return;

      clearAllTimeouts();
      if (workoutMode === "dynamic") {
        if (elapsed < END_OF_ROUND_WARN_MS) {
          scheduleAt(END_OF_ROUND_WARN_MS, () => {
            playBeep();
            speak("ten seconds");
          });
        }
        scheduleAt(END_OF_ROUND_END_MS, () => {
          playBeep();
        });
        if (elapsed < LATEST_DYNAMIC_FIRE_MS) {
          fireDynamicCombo(dynamicNextIdxRef.current);
        }
      } else {
        scheduleClassicRound(round, classicNextReminderIdxRef.current);
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [
    currentRoundData,
    fireDynamicCombo,
    phase,
    playBeep,
    scheduleAt,
    scheduleClassicRound,
    speak,
    workoutMode,
  ]);

  // === Tick (display countdown + work/rest transitions) ===

  const startRest = useCallback(() => {
    setPhase("rest");
    setRestRemaining(REST_DURATION);
    clearAllTimeouts();
    restStartedAtRef.current = Date.now();
    restPausedAccumMsRef.current = 0;
    restPausedAtRef.current = null;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const startNextRound = useCallback(() => {
    setCurrentRound((r) => r + 1);
    setTimeRemaining(WORK_DURATION);
    setRestRemaining(REST_DURATION);
    setPhase("work");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const resetRoundAnchors = useCallback(() => {
    Speech.stop();
    clearAllTimeouts();
    roundStartedAtRef.current = Date.now();
    pausedAccumMsRef.current = 0;
    pausedAtRef.current = null;
  }, [clearAllTimeouts]);

  const finishWorkout = useCallback(() => {
    if (!currentWorkout) return;

    const completedAt = new Date();
    const entry = {
      id: `history-${Date.now()}`,
      workoutPlanId: currentWorkout.id,
      completedAt,
      duration: currentWorkout.duration,
      rounds: currentWorkout.rounds.length,
      workoutName: currentWorkout.name,
      workoutType: currentWorkout.type,
    };

    addWorkoutToHistory(entry);

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
  }, [
    addWorkoutToHistory,
    currentStreak,
    currentWorkout,
    longestStreak,
    speak,
    unlockAchievement,
    unlockedAchievements,
    workoutHistory,
  ]);

  // Round navigation: media-style rewind + skip controls. Both stop any active
  // TTS, clear scheduled timeouts, reset wall-clock anchors, and update state —
  // the existing round-start useEffect re-fires bell + anchor speech for the
  // new round. Skip past the last round triggers finishWorkout → rating modal.
  const skipRound = useCallback(() => {
    if (!isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentRound >= totalRounds) {
      resetRoundAnchors();
      finishWorkout();
      return;
    }
    resetRoundAnchors();
    setCurrentRound((r) => r + 1);
    setTimeRemaining(WORK_DURATION);
    setRestRemaining(REST_DURATION);
    setPhase("work");
  }, [
    currentRound,
    finishWorkout,
    isRunning,
    resetRoundAnchors,
    totalRounds,
  ]);

  const rewindRound = useCallback(() => {
    if (!isRunning) return;
    if (currentRound <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetRoundAnchors();
    setCurrentRound((r) => Math.max(1, r - 1));
    setTimeRemaining(WORK_DURATION);
    setRestRemaining(REST_DURATION);
    setPhase("work");
  }, [currentRound, isRunning, resetRoundAnchors]);

  useEffect(() => {
    if (!isRunning || isPaused) return;

    const tick = () => {
      if (phase === "work") {
        const startedAt = roundStartedAtRef.current;
        if (startedAt == null) return;
        const elapsedSec = Math.floor(
          (Date.now() - startedAt - pausedAccumMsRef.current) / 1000
        );
        const remaining = Math.max(0, WORK_DURATION - elapsedSec);
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          if (currentRound >= totalRounds) {
            finishWorkout();
          } else {
            startRest();
          }
        }
      } else {
        const startedAt = restStartedAtRef.current;
        if (startedAt == null) return;
        const elapsedSec = Math.floor(
          (Date.now() - startedAt - restPausedAccumMsRef.current) / 1000
        );
        const remaining = Math.max(0, REST_DURATION - elapsedSec);
        setRestRemaining(remaining);
        if (remaining <= 0) {
          startNextRound();
        }
      }
    };

    tick();
    const interval = setInterval(tick, 250);

    return () => clearInterval(interval);
  }, [
    currentRound,
    finishWorkout,
    isPaused,
    isRunning,
    phase,
    startNextRound,
    startRest,
    totalRounds,
  ]);

  // Total elapsed workout time (excludes pauses). Updates at 1Hz — display is
  // seconds-precision so we don't need the 250ms cadence of the work/rest tick.
  useEffect(() => {
    if (!isRunning || isPaused) return;
    const update = () => {
      const startedAt = workoutStartedAtRef.current;
      if (startedAt == null) return;
      const elapsedMs =
        Date.now() - startedAt - workoutPausedAccumMsRef.current;
      setTotalElapsedSec(Math.max(0, Math.floor(elapsedMs / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isPaused, isRunning]);

  // Rest-phase narration (preserved).
  useEffect(() => {
    if (!isRunning || isPaused) return;
    if (phase === "rest") {
      if (restSpokenRef.current !== currentRound) {
        restSpokenRef.current = currentRound;
        const nextRound = rounds[currentRound];
        const tip = nextRound?.restTip;
        if (tip) {
          speak(`Rest. ${restRemaining} seconds.`);
          // Plan technique tip for ~25s in.
          setTimeout(() => {
            if (
              isRunningRef.current &&
              !isPausedRef.current &&
              phase === "rest"
            ) {
              speak(tip);
            }
          }, 25_000);
        } else {
          speak(`Rest. ${restRemaining} seconds.`);
        }
      }
    } else {
      restSpokenRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, isPaused, isRunning, phase]);

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

  // === Pause/resume controls ===

  const toggleRunning = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!isRunning) {
      if (workoutStartedAtRef.current == null) {
        workoutStartedAtRef.current = Date.now();
      }
      setIsRunning(true);
      setIsPaused(false);
      return;
    }
    const enteringPause = !isPaused;
    if (enteringPause) {
      if (phase === "work") {
        pausedAtRef.current = Date.now();
      } else {
        restPausedAtRef.current = Date.now();
      }
      workoutPausedAtRef.current = Date.now();
      Speech.stop();
    } else {
      if (workoutMode === "classic") {
        // Nudge round-key effect to re-arm on resume.
        lastScheduledRoundKeyRef.current = null;
      }
      if (workoutPausedAtRef.current != null) {
        workoutPausedAccumMsRef.current +=
          Date.now() - workoutPausedAtRef.current;
        workoutPausedAtRef.current = null;
      }
    }
    setIsPaused(enteringPause);
  };

  // Rest-phase pause accumulator (work has its own effect at lines ~580).
  useEffect(() => {
    if (
      !isPaused &&
      isRunning &&
      phase === "rest" &&
      restPausedAtRef.current != null
    ) {
      restPausedAccumMsRef.current += Date.now() - restPausedAtRef.current;
      restPausedAtRef.current = null;
    }
  }, [isPaused, isRunning, phase]);

  // Foreground service: keeps JS alive on Android while a workout is running.
  // iOS relies on the audio session (set in App.tsx). On unmount we always
  // stop, so navigating away cleans up.
  useEffect(() => {
    if (isRunning) {
      startWorkoutBackgroundTask().catch(() => {});
    } else {
      stopWorkoutBackgroundTask().catch(() => {});
    }
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const desc =
      phase === "work"
        ? `Round ${currentRound} of ${totalRounds}`
        : `Rest before round ${Math.min(currentRound + 1, totalRounds)}`;
    updateWorkoutBackgroundTask(desc).catch(() => {});
  }, [isRunning, phase, currentRound, totalRounds]);

  useEffect(() => {
    return () => {
      stopWorkoutBackgroundTask().catch(() => {});
    };
  }, []);

  // === Rating + progression flow ===

  const persistProgressionUpdate = useCallback(
    async (outcome: RatingOutcome) => {
      if (!currentWorkout || !boxingLevel) return null;

      const result = computeProgression({
        currentLevel: boxingLevel,
        currentProgress: nextLevelProgress,
        outcome,
        levelCapStayingSince,
        levelCapTooEasyCountSinceStay,
        demotionWindow,
      });

      applyProgressionResult(result);

      // Collect raw anchor notations for the variety ring buffer. Sent verbatim
      // to the EF, which inlines them in the user prompt as "avoid these". We
      // store notations (not hashes) because Claude reads them as text.
      const newNotations = currentWorkout.rounds.map(
        (r) => r.anchorCombo.notation
      );
      pushComboSignatures(newNotations);

      if (userId) {
        const totalMinutes = workoutHistory.reduce(
          (sum, w) => sum + (w.duration || 0),
          0
        );
        const updatedSignatures = useUserStore.getState().recentComboSignatures;
        upsertUserStats(userId, {
          userId,
          totalWorkouts: workoutHistory.length + 1,
          totalMinutes: totalMinutes + currentWorkout.duration,
          currentLevel: boxingLevel,
          nextLevelProgress: result.newProgress,
          currentStreak,
          longestStreak,
          lastWorkoutDate: (finishedAt ?? new Date()).toISOString(),
          levelCapStayingSince,
          levelCapTooEasyCountSinceStay: result.newLevelCapTooEasyCount,
          recentComboSignatures: updatedSignatures,
          demotionWindow: result.newDemotionWindow,
        }).catch(() => {});
      }

      return result;
    },
    [
      applyProgressionResult,
      boxingLevel,
      currentStreak,
      currentWorkout,
      demotionWindow,
      finishedAt,
      levelCapStayingSince,
      levelCapTooEasyCountSinceStay,
      longestStreak,
      nextLevelProgress,
      pushComboSignatures,
      userId,
      workoutHistory,
    ]
  );

  const submitRating = useCallback(
    async (rating: 1 | 2 | 3) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const completedAt = finishedAt ?? new Date();

      const outcome: RatingOutcome = isEarlyExitRef.current
        ? "early_exit"
        : ratingToOutcome(rating);
      const result = await persistProgressionUpdate(outcome);

      if (currentWorkout && userId) {
        const tel = currentWorkout.signalTelemetry;
        logWorkoutSession({
          userId,
          workoutName: currentWorkout.name,
          difficulty: currentWorkout.difficulty,
          duration: currentWorkout.duration,
          rounds: currentWorkout.rounds.length,
          completedAt: completedAt.toISOString(),
          durationMinutes: Math.round(currentWorkout.duration),
          combosAttempted: currentWorkout.rounds.length,
          combosCompleted: currentWorkout.rounds.length,
          accuracy: 0,
          difficultyRating: rating,
          signalStruggleHitCount: tel?.struggleHitCount,
          signalSuccessHitCount: tel?.successHitCount,
          signalRecentHitCount: tel?.recentHitCount,
          signalAtLevelCap: tel?.atLevelCap,
          signalFeatureStruggles: tel?.featureStruggles,
          signalFeatureSuccesses: tel?.featureSuccesses,
          signalSkipCount: skipCountRef.current,
        }).catch(() => {});

        // Adaptive-learning telemetry: only on real ratings (not early-exit).
        // Each anchor's count gets +1 in the bucket matching the rating.
        if (!isEarlyExitRef.current) {
          recordComboProgressForSession(
            userId,
            currentWorkout.rounds.map((r) => ({
              notation: r.anchorCombo.notation,
              name: currentWorkout.name,
            })),
            rating
          ).catch(() => {});
        }
      }

      setShowRating(false);

      if (
        result?.shouldShowCelebration &&
        result.newLevelIfAdvancing &&
        !isEarlyExitRef.current
      ) {
        setPendingAdvanceLevel(result.newLevelIfAdvancing);
        setShowLevelUp(true);
      } else {
        postWorkoutAd.show(() => navigation.goBack());
      }
    },
    [
      currentWorkout,
      finishedAt,
      navigation,
      persistProgressionUpdate,
      postWorkoutAd,
      userId,
    ]
  );

  const skipRating = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const completedAt = finishedAt ?? new Date();
    const outcome: RatingOutcome = isEarlyExitRef.current
      ? "early_exit"
      : "skipped";
    const result = await persistProgressionUpdate(outcome);

    if (currentWorkout && userId) {
      const tel = currentWorkout.signalTelemetry;
      logWorkoutSession({
        userId,
        workoutName: currentWorkout.name,
        difficulty: currentWorkout.difficulty,
        duration: currentWorkout.duration,
        rounds: currentWorkout.rounds.length,
        completedAt: completedAt.toISOString(),
        durationMinutes: Math.round(currentWorkout.duration),
        combosAttempted: currentWorkout.rounds.length,
        combosCompleted: currentWorkout.rounds.length,
        accuracy: 0,
        signalStruggleHitCount: tel?.struggleHitCount,
        signalSuccessHitCount: tel?.successHitCount,
        signalRecentHitCount: tel?.recentHitCount,
        signalAtLevelCap: tel?.atLevelCap,
        signalFeatureStruggles: tel?.featureStruggles,
        signalFeatureSuccesses: tel?.featureSuccesses,
        signalSkipCount: skipCountRef.current,
      }).catch(() => {});
    }

    setShowRating(false);

    if (
      result?.shouldShowCelebration &&
      result.newLevelIfAdvancing &&
      !isEarlyExitRef.current
    ) {
      setPendingAdvanceLevel(result.newLevelIfAdvancing);
      setShowLevelUp(true);
    } else {
      postWorkoutAd.show(() => navigation.goBack());
    }
  }, [
    currentWorkout,
    finishedAt,
    navigation,
    persistProgressionUpdate,
    postWorkoutAd,
    userId,
  ]);

  // === Level-up modal handlers ===

  const handleAdvance = useCallback(() => {
    if (!boxingLevel || !pendingAdvanceLevel) return;
    // applyProgressionResult wrote the raw (possibly >100) progress, so the
    // store's nextLevelProgress holds the overflow.
    const storeProgress = useUserStore.getState().nextLevelProgress;
    const carry = Math.max(0, storeProgress - 100);
    advanceLevel(pendingAdvanceLevel, carry);
    if (userId) {
      upsertUserStats(userId, {
        userId,
        currentLevel: pendingAdvanceLevel,
        nextLevelProgress: carry,
        levelCapStayingSince: null,
        levelCapTooEasyCountSinceStay: 0,
        demotionWindow: [],
      }).catch(() => {});
    }
    unlockAchievement(
      pendingAdvanceLevel === "intermediate"
        ? "level_up_inter"
        : "level_up_advanced"
    );
    setShowLevelUp(false);
    setPendingAdvanceLevel(null);
    postWorkoutAd.show(() => navigation.goBack());
  }, [
    advanceLevel,
    boxingLevel,
    navigation,
    pendingAdvanceLevel,
    postWorkoutAd,
    unlockAchievement,
    userId,
  ]);

  const handleStay = useCallback(() => {
    setLevelCapStaying(new Date().toISOString(), 0);
    if (userId && boxingLevel) {
      upsertUserStats(userId, {
        userId,
        currentLevel: boxingLevel,
        nextLevelProgress: 100,
        levelCapStayingSince: new Date().toISOString(),
        levelCapTooEasyCountSinceStay: 0,
      }).catch(() => {});
    }
    setShowLevelUp(false);
    setPendingAdvanceLevel(null);
    postWorkoutAd.show(() => navigation.goBack());
  }, [
    boxingLevel,
    navigation,
    postWorkoutAd,
    setLevelCapStaying,
    userId,
  ]);

  const endWorkout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Speech.stop();
    clearAllTimeouts();
    setIsRunning(false);
    setIsPaused(false);
    isEarlyExitRef.current = true;
    setFinishedAt(new Date());
    setShowRating(true);
    speak("Workout ended. Showing up is half the fight — every rep is in the bank.");
    speak("Rate how it felt — it helps me dial in the next workout for you.");
  };

  const watchLesson = async () => {
    if (!anchor) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const query = `boxing combo ${anchor.notation} tutorial`;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening YouTube:", error);
    }
  };

  if (!currentWorkout || rounds.length === 0) {
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

  const visibleNotation =
    workoutMode === "dynamic"
      ? dynamicNotation ?? anchor?.notation ?? "---"
      : anchor?.notation ?? "---";

  // Dynamic font sizing for the combo display. Goal: every combo feels big,
  // regardless of length. Short combos like "1-2b" hit max size; longer combos
  // like "1-2-slip right-3-pivot left-4" step down through readable tiers and
  // can wrap to 2 lines. minimumFontScale on the Text component (paired with
  // numberOfLines: 2) ensures we never shrink past readability.
  const comboDisplay = expandForDisplay(visibleNotation);
  // React Native's wrap is greedy — it packs line 1 as full as possible, so
  // long combos render with a stuffed line 1 + nearly-empty line 2, and the
  // autoshrink targets the long line. Force a balanced break at the midpoint
  // by finding the nearest hyphen or space and replacing/inserting a newline
  // there. Both lines end up roughly equal length, so autoshrink can target
  // a much larger font size.
  const comboDisplayWrappable = balancedTwoLineWrap(comboDisplay);
  const comboFontSize =
    comboDisplay.length <= 5
      ? 144
      : comboDisplay.length <= 9
        ? 128
        : comboDisplay.length <= 14
          ? 112
          : comboDisplay.length <= 22
            ? 100
            : comboDisplay.length <= 32
              ? 92
              : 80;

  const totalMins = Math.floor(totalElapsedSec / 60);
  const totalSecsRem = totalElapsedSec % 60;
  const totalDisplay = `${totalMins}:${String(totalSecsRem).padStart(2, "0")}`;

  // Per-segment fill for the round indicator bar. Past rounds full, future
  // empty; the active round fills proportionally with work progress (and stays
  // full during rest, since the work was completed).
  const currentWorkFill =
    phase === "rest" ? 1 : (WORK_DURATION - timeRemaining) / WORK_DURATION;

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
        {/* Round progress segments — past full gold, current fills with work
            progress, future stays gray. One segment per round. */}
        <View className="px-6 pt-2 flex-row" style={{ gap: 4 }}>
          {Array.from({ length: totalRounds }).map((_, i) => {
            const fill =
              i < currentRound - 1
                ? 1
                : i === currentRound - 1
                  ? currentWorkFill
                  : 0;
            return (
              <View
                key={i}
                className="flex-1 bg-gray-800 rounded-full overflow-hidden"
                style={{ height: 3 }}
              >
                <View
                  className="bg-boxing-gold"
                  style={{
                    height: 3,
                    width: `${Math.min(100, Math.max(0, fill * 100))}%`,
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Header */}
        <View className="px-6 py-3 flex-row items-start justify-between">
          <Text className="text-boxing-gold text-xs font-bold uppercase tracking-widest mt-1">
            {currentWorkout.difficulty}
          </Text>
          <View className="items-end" style={{ gap: 4 }}>
            <Text className="text-white text-base font-semibold">
              {totalDisplay}
            </Text>
            <Text className="text-white text-sm">
              Round {currentRound} / {totalRounds}
            </Text>
            {workoutMode === "classic" && currentRoundData?.classicDescription ? (
              <Pressable
                onPress={() => setShowDescription(true)}
                className="active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Show coaching notes"
                hitSlop={8}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={28}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Main Timer Area — chronometer + combo centered as one group */}
        <View className="flex-1 items-center justify-center px-6" style={{ gap: 32 }}>
          {/* Large Timer */}
          <Text
            className="text-white font-black tracking-tight leading-none"
            style={{ fontSize: 96 }}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>

          {/* Combo — dynamic font size + 2-line wrap fallback for long combos */}
          <View className="w-full items-center">
            {phase === "rest" ? (
              <Text
                className="text-boxing-red font-black tracking-widest text-center"
                style={{ fontSize: 144, lineHeight: 148 }}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                REST
              </Text>
            ) : (
              <Animated.View
                style={[cardStyle, { width: "100%", alignItems: "center" }]}
              >
                <Text
                  className="text-boxing-red font-black tracking-wider text-center"
                  style={{ fontSize: comboFontSize }}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                  numberOfLines={comboDisplay.length <= 9 ? 1 : 2}
                >
                  {comboDisplayWrappable}
                </Text>
                {/* Description hidden — accessible via (i) icon in the header */}
              </Animated.View>
            )}
            {workoutMode === "dynamic" &&
            phase === "work" &&
            isRunning &&
            !isPaused ? (
              <Pressable
                onPress={handleSkipCombo}
                hitSlop={12}
                className="active:opacity-60 mt-5"
                accessibilityRole="button"
                accessibilityLabel="Skip this combo — records it as too hard"
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 6 }}
                >
                  <Ionicons
                    name="play-skip-forward-outline"
                    size={14}
                    color="#9CA3AF"
                  />
                  <Text className="text-gray-400 text-xs uppercase tracking-widest font-semibold">
                    Skip combo
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Media controls — rewind | pause/play | skip */}
        <View className="px-6 mb-3">
          <View
            className="flex-row items-center justify-center"
            style={{ gap: 48 }}
          >
            <Pressable
              onPress={rewindRound}
              disabled={currentRound <= 1 || !isRunning}
              className="active:opacity-70"
              style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Previous round"
            >
              <Ionicons
                name="play-skip-back"
                size={36}
                color={currentRound <= 1 || !isRunning ? "#444" : "#FFFFFF"}
              />
            </Pressable>

            <Pressable
              onPress={toggleRunning}
              className="active:opacity-80"
              style={{ width: 72, height: 72 }}
              accessibilityRole="button"
              accessibilityLabel={isPaused || !isRunning ? "Play" : "Pause"}
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

            <Pressable
              onPress={skipRound}
              disabled={!isRunning}
              className="active:opacity-70"
              style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={currentRound >= totalRounds ? "Finish workout" : "Next round"}
            >
              <Ionicons
                name="play-skip-forward"
                size={36}
                color={!isRunning ? "#444" : "#FFFFFF"}
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BannerAdView />
      </View>

      {/* Coaching-notes modal — opened from the (i) icon in the header */}
      {showDescription && currentRoundData?.classicDescription ? (
        <Pressable
          onPress={() => setShowDescription(false)}
          className="absolute inset-0 bg-black/85 items-center justify-center px-6"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss coaching notes"
        >
          <Pressable
            onPress={() => {}}
            className="bg-[#1A1A1A] rounded-3xl w-full"
            style={{ maxWidth: 400 }}
          >
            <View className="px-6 py-5 border-b border-gray-800 flex-row items-center justify-between">
              <Text className="text-white text-lg font-bold">Coaching notes</Text>
              <Pressable
                onPress={() => setShowDescription(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>
            <View className="px-6 py-5">
              <Text
                className="text-boxing-red font-black tracking-wider text-center mb-3"
                style={{ fontSize: 28 }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {expandForDisplay(visibleNotation)}
              </Text>
              <Text className="text-gray-300 text-base leading-6 text-center">
                {currentRoundData.classicDescription}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

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

      {/* Pause Modal */}
      {isPaused && (
        <View
          className="absolute inset-0 bg-black/80 items-center justify-center"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <View
            className="bg-[#1A1A1A] rounded-3xl mx-6 w-full max-w-md"
            style={{ maxWidth: 400 }}
          >
            <View className="px-6 py-5 border-b border-gray-800">
              <Text className="text-white text-xl font-bold">Paused</Text>
            </View>
            <View className="p-6">
              <Text className="text-gray-400 text-center text-sm mb-6">
                Watch a quick lesson for this combo
              </Text>
              <Pressable onPress={watchLesson} className="active:opacity-90 mb-3">
                <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-red">
                  <Text className="text-white text-center text-base font-bold">
                    Watch lesson on YouTube
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={toggleRunning} className="active:opacity-90 mb-3">
                <View className="bg-black rounded-xl py-4 px-6 border-2 border-boxing-gold">
                  <Text className="text-white text-center text-base font-bold">
                    Resume
                  </Text>
                </View>
              </Pressable>
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

      <LevelUpModal
        visible={showLevelUp && !!boxingLevel}
        currentLevel={boxingLevel ?? "beginner"}
        onAdvance={handleAdvance}
        onStay={handleStay}
      />
    </LinearGradient>
  );
}

export default TimerScreen;
