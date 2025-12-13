import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "../state/userStore";
import { generateWorkout } from "../api/workout-generator";
import WorkoutCard from "../components/WorkoutCard";
import PulsingEnergyLoader from "../components/PulsingEnergyLoader";

type RootStackParamList = {
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList>;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const boxingLevel = useUserStore((s) => s.boxingLevel);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const currentWorkout = useUserStore((s) => s.currentWorkout);
  const setCurrentWorkout = useUserStore((s) => s.setCurrentWorkout);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const updateStreaks = useUserStore((s) => s.updateStreaks);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateStreaks();
    if (!currentWorkout && boxingLevel) {
      loadWorkout();
    }
  }, [currentWorkout, boxingLevel]);

  const loadWorkout = async () => {
    if (!boxingLevel) return;

    setIsGenerating(true);
    setError(null);

    try {
      const workout = await generateWorkout(boxingLevel, workoutHistory.length);
      setCurrentWorkout(workout);
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
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-4xl font-black text-white mb-2">
                Ready to Train?
              </Text>
              <Text className="text-lg text-gray-400">
                Your personalized workout is ready
              </Text>
            </View>
            {currentStreak > 0 && (
              <View className="bg-boxing-gold/20 border border-boxing-gold rounded-2xl px-4 py-3 items-center">
                <Text className="text-3xl font-black text-boxing-gold">
                  {currentStreak}
                </Text>
                <Text className="text-xs text-boxing-gold font-bold">
                  🔥 STREAK
                </Text>
              </View>
            )}
          </View>
        </View>

        {isGenerating && <PulsingEnergyLoader />}

        {error && (
          <View className="mx-6 mb-6 bg-boxing-red/20 border border-boxing-red rounded-2xl p-4">
            <Text className="text-boxing-red text-center">{error}</Text>
          </View>
        )}

        {!isGenerating && currentWorkout && (
          <WorkoutCard
            workout={currentWorkout}
            onStartTraining={handleStartTraining}
          />
        )}
      </ScrollView>
    </LinearGradient>
  );
}
