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
    <LinearGradient colors={["#000000", "#1A0000"]} style={{ flex: 1 }}>
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
          <Text className="text-boxing-gold text-base">
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
              <View
                style={{ 
                  backgroundColor: activeTab === tab ? '#000000' : '#2D2D2D',
                  borderRadius: 12, 
                  paddingVertical: 12 
                }}
              >
                <Text
                  className={`text-center font-bold uppercase tracking-wider ${
                    activeTab === tab ? "text-white" : "text-gray-400"
                  }`}
                >
                  {tab === "favorites" ? "Favorites" : "Recent"}
                </Text>
              </View>
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
              <View
                style={{ 
                  backgroundColor: selectedType === type ? '#000000' : '#2D2D2D',
                  borderRadius: 20, 
                  paddingVertical: 10, 
                  paddingHorizontal: 16 
                }}
              >
                <Text
                  className={`font-semibold uppercase tracking-wider ${
                    selectedType === type ? "text-white" : "text-gray-400"
                  }`}
                >
                  {type === "all"
                    ? "All"
                    : type === "quick"
                      ? "Quick"
                      : type === "power"
                        ? "Power"
                        : type === "endurance"
                          ? "Endurance"
                          : "Technique"}
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
                beginner: "text-boxing-gold",
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
                    style={{ borderRadius: 16, padding: 16, borderWidth: 2, borderColor: "#DC2626" }}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-white mb-1">{workout.name}</Text>
                        <View className="flex-row items-center space-x-2">
                          <Text className={`text-xs font-semibold ${difficultyColor}`}>
                            {workout.difficulty.toUpperCase()}
                          </Text>
                          <Text className="text-xs text-gray-500">•</Text>
                          <Text className="text-xs text-boxing-gold uppercase tracking-wider">
                            {workout.type === "quick"
                              ? "Quick"
                              : workout.type === "power"
                                ? "Power"
                                : workout.type === "endurance"
                                  ? "Endurance"
                                  : "Technique"}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleFavorite(workout.id)}
                        hitSlop={8}
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          workout.isFavorite ? "bg-boxing-red" : "bg-gray-700"
                        }`}
                      >
                        <Text className={`text-sm font-black ${
                          workout.isFavorite ? "text-white" : "text-gray-500"
                        }`}>
                          ♥
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

                    <Pressable className="bg-boxing-red/10 border border-boxing-red rounded-lg py-2 px-3">
                      <Text className="text-boxing-red text-center font-bold uppercase tracking-wider">
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
        <View className="mx-6 mt-8 bg-boxing-red/10 border-2 border-boxing-red rounded-2xl p-4">
          <View className="flex-row items-start space-x-3">
            <View className="w-10 h-10 rounded-full border-2 border-boxing-gold items-center justify-center">
              <Text className="text-boxing-gold font-black text-xl">+</Text>
            </View>
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
