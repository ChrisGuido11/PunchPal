import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useUserStore } from "../state/userStore";
import { WorkoutType, SavedWorkout } from "../types/workout";

type RootStackParamList = {
  Library: undefined;
  Home: undefined;
  Timer: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

type Tab = "favorites" | "recent";

export default function WorkoutLibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const favoriteWorkouts = useUserStore((s) => s.favoriteWorkouts);
  const recentlyCompleted = useUserStore((s) => s.recentlyCompleted);
  const setCurrentWorkout = useUserStore((s) => s.setCurrentWorkout);

  const [activeTab, setActiveTab] = useState<Tab>("favorites");
  const [selectedType, setSelectedType] = useState<WorkoutType | "all">("all");

  const workoutTypes: (WorkoutType | "all")[] = ["all", "quick", "power", "endurance", "technique"];

  const filteredWorkouts = useMemo(() => {
    const source = activeTab === "favorites" ? favoriteWorkouts : recentlyCompleted;
    if (selectedType === "all") return source;
    return source.filter((w) => w.type === selectedType);
  }, [activeTab, selectedType, favoriteWorkouts, recentlyCompleted]);

  const handleSelectWorkout = (workout: SavedWorkout) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentWorkout(workout);
    navigation.navigate("Timer");
  };

  const handleFavorite = (workoutId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Toggle favorite in store
  };

  return (
    <LinearGradient colors={["#0F0F0F", "#1A1A1A"]} style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="px-6 mb-6">
          <Pressable onPress={() => navigation.goBack()} className="mb-4">
            <Text className="text-boxing-gold text-lg font-semibold">← Back</Text>
          </Pressable>
          <Text className="text-4xl font-black text-white mb-2">Workout Library</Text>
          <Text className="text-gray-400 text-base">
            {activeTab === "favorites" ? "Your favorite workouts" : "Recently completed"}
          </Text>
        </View>

        {/* Tabs */}
        <View className="px-6 flex-row space-x-3 mb-6">
          {(["favorites", "recent"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
                setSelectedType("all");
              }}
              className="flex-1"
            >
              <LinearGradient
                colors={
                  activeTab === tab ? ["#DC2626", "#B91C1C"] : ["#2D2D2D", "#3D3D3D"]
                }
                style={{ borderRadius: 12, paddingVertical: 12 }}
              >
                <Text
                  className={`text-center font-bold ${
                    activeTab === tab ? "text-white" : "text-gray-400"
                  }`}
                >
                  {tab === "favorites" ? "❤️ Favorites" : "🕐 Recent"}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {/* Type Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-6 mb-6"
          contentContainerStyle={{ paddingRight: 24 }}
        >
          {workoutTypes.map((type) => (
            <Pressable
              key={type}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedType(type);
              }}
              className="mr-3"
            >
              <LinearGradient
                colors={
                  selectedType === type ? ["#DC2626", "#B91C1C"] : ["#2D2D2D", "#3D3D3D"]
                }
                style={{ borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text
                  className={`font-semibold ${
                    selectedType === type ? "text-white" : "text-gray-400"
                  }`}
                >
                  {type === "all"
                    ? "All"
                    : type === "quick"
                      ? "⚡ Quick"
                      : type === "power"
                        ? "💥 Power"
                        : type === "endurance"
                          ? "🏃 Endurance"
                          : "🎯 Technique"}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>

        {/* Workouts */}
        {filteredWorkouts.length === 0 ? (
          <View className="px-6 items-center justify-center py-12">
            <Text className="text-gray-400 text-lg text-center">
              {activeTab === "favorites"
                ? "No favorite workouts yet.\nLike workouts while training!"
                : "No recently completed workouts.\nStart a workout to see it here!"}
            </Text>
          </View>
        ) : (
          <View className="px-6 space-y-4">
            {filteredWorkouts.map((workout) => {
              const difficultyColor = {
                beginner: "text-green-400",
                intermediate: "text-boxing-gold",
                advanced: "text-boxing-red",
              }[workout.difficulty];

              return (
                <Pressable
                  key={workout.id}
                  onPress={() => handleSelectWorkout(workout)}
                  className="active:opacity-80"
                >
                  <LinearGradient
                    colors={["#1A1A1A", "#2A2A2A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#3D3D3D" }}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-white mb-1">{workout.name}</Text>
                        <View className="flex-row items-center space-x-2">
                          <Text className={`text-xs font-semibold ${difficultyColor}`}>
                            {workout.difficulty.toUpperCase()}
                          </Text>
                          <Text className="text-xs text-gray-500">•</Text>
                          <Text className="text-xs text-gray-400">
                            {workout.type === "quick"
                              ? "⚡ Quick"
                              : workout.type === "power"
                                ? "💥 Power"
                                : workout.type === "endurance"
                                  ? "🏃 Endurance"
                                  : "🎯 Technique"}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleFavorite(workout.id)}
                        hitSlop={8}
                      >
                        <Text className="text-2xl">
                          {workout.isFavorite ? "❤️" : "🤍"}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="flex-row space-x-2 mb-4">
                      <View className="flex-1 bg-black/30 rounded-lg p-3">
                        <Text className="text-gray-500 text-xs mb-1">Duration</Text>
                        <Text className="text-white font-bold">{workout.duration} min</Text>
                      </View>
                      <View className="flex-1 bg-black/30 rounded-lg p-3">
                        <Text className="text-gray-500 text-xs mb-1">Rounds</Text>
                        <Text className="text-white font-bold">{workout.rounds}</Text>
                      </View>
                      <View className="flex-1 bg-black/30 rounded-lg p-3">
                        <Text className="text-gray-500 text-xs mb-1">Combos</Text>
                        <Text className="text-white font-bold">{workout.combos.length}</Text>
                      </View>
                    </View>

                    <Pressable className="bg-boxing-gold/10 rounded-lg py-2 px-3">
                      <Text className="text-boxing-gold text-center font-bold">
                        Start Workout
                      </Text>
                    </Pressable>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Premium Custom Builder Hint */}
        <View className="mx-6 mt-8 bg-boxing-gold/10 border border-boxing-gold rounded-2xl p-4">
          <View className="flex-row items-start space-x-3">
            <Text className="text-2xl">💎</Text>
            <View className="flex-1">
              <Text className="text-boxing-gold font-bold mb-1">Custom Workout Builder</Text>
              <Text className="text-gray-300 text-sm">
                Premium feature coming soon. Build your own workouts tailored to your goals.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
