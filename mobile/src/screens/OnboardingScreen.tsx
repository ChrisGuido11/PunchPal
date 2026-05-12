import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
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

type Step = "level" | "voice";

const PREMIUM_VOICE_HINTS = ["nathan", "aaron", "evan", "tom", "reed", "siri_male"];

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedLevel, setSelectedLevel] = useState<BoxingLevel | null>(null);
  const [step, setStep] = useState<Step>("level");
  const [needsVoiceTip, setNeedsVoiceTip] = useState<boolean | null>(null);
  const userId = useUserStore((s) => s.userId);
  const setBoxingLevel = useUserStore((s) => s.setBoxingLevel);
  const setHasCompletedOnboarding = useUserStore(
    (s) => s.setHasCompletedOnboarding
  );

  useEffect(() => {
    let cancelled = false;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled) return;
        const hasPremiumMale = voices.some((v) => {
          if (!v.language.startsWith("en")) return false;
          if (v.quality === Speech.VoiceQuality.Default) return false;
          const haystack = (v.name + " " + v.identifier).toLowerCase();
          return PREMIUM_VOICE_HINTS.some((hint) => haystack.includes(hint));
        });
        setNeedsVoiceTip(!hasPremiumMale);
      })
      .catch(() => {
        setNeedsVoiceTip(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finalizeOnboarding = async () => {
    if (!selectedLevel) return;

    setBoxingLevel(selectedLevel);
    setHasCompletedOnboarding(true);

    if (userId) {
      await upsertUserStats(userId, {
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
    }

    navigation.replace("MainTabs");
  };

  const handleContinueLevel = () => {
    if (!selectedLevel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (needsVoiceTip) {
      setStep("voice");
    } else {
      finalizeOnboarding();
    }
  };

  const handleFinishVoiceStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finalizeOnboarding();
  };

  const openIosSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openSettings();
    } catch {
      // openSettings can throw if Settings isn't reachable — silently ignore.
    }
  };

  const previewVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Speech.speak("Jab, cross, lead hook. Keep your hands up.", {
      language: "en-US",
      rate: 0.95,
      pitch: 1,
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
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
      >
        {step === "level" ? (
          <>
            <View className="mb-10">
              <Text className="text-4xl font-black text-white mb-3">
                Welcome to PunchPal
              </Text>
              <Text className="text-lg text-boxing-gold">
                Select your boxing experience level to get personalized workouts
              </Text>
            </View>

            <View className="space-y-3 mb-6">
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
                    className={`bg-boxing-cardBg border-2 rounded-2xl p-5 ${
                      selectedLevel === level.value
                        ? "border-boxing-red"
                        : "border-boxing-cardBorder"
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xl font-bold text-white">
                        {level.title}
                      </Text>
                      {selectedLevel === level.value && (
                        <Text className="text-2xl text-boxing-red font-black">
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text className="text-sm text-gray-400">
                      {level.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleContinueLevel}
              disabled={!selectedLevel}
              className="active:opacity-80"
            >
              <View
                style={{
                  backgroundColor: selectedLevel ? "#000000" : "#374151",
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
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setStep("level")}
              className="active:opacity-70 mb-6 flex-row items-center"
            >
              <Ionicons name="chevron-back" size={20} color="#D4AF37" />
              <Text className="text-boxing-gold text-sm font-bold ml-1">
                Back
              </Text>
            </Pressable>

            <View className="mb-8">
              <Text className="text-4xl font-black text-white mb-3">
                Upgrade Your Coach Voice
              </Text>
              <Text className="text-lg text-boxing-gold">
                Optional — takes 30 seconds and makes a big difference
              </Text>
            </View>

            <View className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-2xl p-5 mb-4">
              <Text className="text-white text-lg font-bold mb-2">
                Download the &quot;Nathan&quot; voice
              </Text>
              <Text className="text-gray-400 text-sm leading-6 mb-4">
                Your iPhone ships with a basic voice that sounds robotic during
                workouts. Nathan is a free premium Apple voice that&apos;s clear,
                deep, and natural — perfect for calling out combos.
              </Text>

              <View className="bg-black/40 rounded-xl p-4 mb-4">
                <Text className="text-boxing-gold text-xs font-bold uppercase tracking-widest mb-3">
                  How to download
                </Text>
                <View className="space-y-2">
                  <Text className="text-gray-300 text-sm leading-5">
                    <Text className="text-boxing-red font-bold">1.</Text> Open{" "}
                    <Text className="text-white font-bold">Settings</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm leading-5">
                    <Text className="text-boxing-red font-bold">2.</Text> Tap{" "}
                    <Text className="text-white font-bold">Accessibility</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm leading-5">
                    <Text className="text-boxing-red font-bold">3.</Text> Tap{" "}
                    <Text className="text-white font-bold">Spoken Content</Text>{" "}
                    →{" "}
                    <Text className="text-white font-bold">Voices</Text> →{" "}
                    <Text className="text-white font-bold">English</Text>
                  </Text>
                  <Text className="text-gray-300 text-sm leading-5">
                    <Text className="text-boxing-red font-bold">4.</Text> Find{" "}
                    <Text className="text-white font-bold">Nathan</Text> and tap
                    the download icon next to it
                  </Text>
                </View>
                <Text className="text-gray-500 text-xs mt-3 leading-5">
                  Can&apos;t find Nathan? Any voice with a &quot;Premium&quot;
                  or &quot;Enhanced&quot; label works — try Aaron, Evan, or
                  Tom.
                </Text>
              </View>

              <Pressable onPress={openIosSettings} className="active:opacity-80">
                <View className="bg-boxing-red rounded-xl py-4 flex-row items-center justify-center">
                  <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                  <Text className="text-white font-bold ml-2">
                    Open Settings
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable onPress={previewVoice} className="active:opacity-70 mb-6">
              <View className="bg-transparent border-2 border-boxing-cardBorder rounded-2xl py-3 flex-row items-center justify-center">
                <Ionicons name="volume-medium" size={18} color="#D4AF37" />
                <Text className="text-boxing-gold font-bold ml-2">
                  Test current voice
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleFinishVoiceStep}
              className="active:opacity-80"
            >
              <View
                style={{
                  backgroundColor: "#000000",
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: "#DC2626",
                }}
              >
                <Text className="text-white text-xl font-bold text-center">
                  I&apos;m Ready — Start Training
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleFinishVoiceStep}
              className="active:opacity-60 mt-3"
            >
              <Text className="text-gray-500 text-center text-sm">
                Skip for now
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
