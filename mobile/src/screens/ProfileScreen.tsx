import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import { BoxingLevel } from "../types/workout";
import { ACHIEVEMENTS, getAchievementProgress } from "../utils/achievements";
import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { TABLES } from "../lib/tables";
import { upsertUserStats } from "../api/database-service";

type RootStackParamList = {
  Auth: undefined;
  Splash: undefined;
};

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useUserStore((s) => s.userId);
  const boxingLevel = useUserStore((s) => s.boxingLevel);
  const setBoxingLevel = useUserStore((s) => s.setBoxingLevel);
  const workoutHistory = useUserStore((s) => s.workoutHistory);
  const clearWorkoutHistory = useUserStore((s) => s.clearWorkoutHistory);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const longestStreak = useUserStore((s) => s.longestStreak);
  const unlockedAchievements = useUserStore((s) => s.unlockedAchievements);

  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserEmail(data.user?.email ?? null);
      setIsAnonymous(data.user?.is_anonymous ?? !data.user?.email);
    };
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLevelChange = async (level: BoxingLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBoxingLevel(level);
    setIsEditingLevel(false);

    // Sync boxing level change to Supabase for AI personalization
    if (userId) {
      console.log('Profile: Updating boxing level to:', level);
      const totalMinutes = workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0);
      const combosCompleted = new Set(workoutHistory.flatMap(w => w.combos || [])).size;
      const avgAccuracy = workoutHistory.length > 0 
        ? workoutHistory.reduce((sum, w) => sum + (w.accuracy || 0), 0) / workoutHistory.length 
        : 0;
      
      const thresholds = { beginner: 20, intermediate: 50, advanced: 100 };
      const threshold = thresholds[level];
      const progress = Math.min(Math.round((workoutHistory.length / threshold) * 100), 100);

      const result = await upsertUserStats(userId, {
        userId,
        totalWorkouts: workoutHistory.length,
        totalMinutes,
        currentLevel: level,
        nextLevelProgress: progress,
        combosLearned: combosCompleted,
        currentStreak,
        longestStreak,
        avgAccuracy: Math.round(avgAccuracy),
        lastWorkoutDate: workoutHistory.length > 0 
          ? new Date(workoutHistory[workoutHistory.length - 1].completedAt).toISOString() 
          : null,
      });
      console.log('Profile: Level update result:', result ? 'Success' : 'Failed');
    } else {
      console.log('Profile: No userId found, skipping Supabase sync');
    }
  };

  const handleClearHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearWorkoutHistory();
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            if (isSupabaseEnabled()) {
              await supabase.auth.signOut();
            }
            
            // Clear user store
            useUserStore.setState({ 
              userId: null,
              hasCompletedOnboarding: false,
              workoutHistory: [],
              currentStreak: 0,
              longestStreak: 0,
            });
            
            navigation.reset({
              index: 0,
              routes: [{ name: "Splash" }],
            });
          },
        },
      ]
    );
  };

  const handleSignInPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Auth");
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            if (isSupabaseEnabled()) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // Delete user data from database
                await supabase.from(TABLES.userStats).delete().eq('user_id', user.id);
                await supabase.from(TABLES.workoutSessions).delete().eq('user_id', user.id);
                await supabase.from(TABLES.comboProgress).delete().eq('user_id', user.id);

                // Delete auth account (requires admin privileges in production)
                // In production, you'd call a server function to handle this
              }

              await supabase.auth.signOut();
            }

            // Clear all user data
            useUserStore.setState({
              userId: null,
              hasCompletedOnboarding: false,
              boxingLevel: null,
              workoutHistory: [],
              currentStreak: 0,
              longestStreak: 0,
              lastWorkoutDate: null,
              currentWorkout: null,
              favoriteWorkouts: [],
              recentlyCompleted: [],
              unlockedAchievements: [],
            });

            navigation.reset({
              index: 0,
              routes: [{ name: "Splash" }],
            });
          },
        },
      ]
    );
  };

  const handleOpenPrivacyPolicy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL("https://punchpal-privacy-policy.lovable.app/");
    } catch (error) {
      console.error("Failed to open privacy policy:", error);
    }
  };

  const handleOpenSupport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL("https://punchpalsupport.lovable.app/");
    } catch (error) {
      console.error("Failed to open support website:", error);
    }
  };

  const totalWorkouts = workoutHistory.length;
  const totalDuration = workoutHistory.reduce(
    (sum, workout) => sum + workout.duration,
    0
  );
  const totalRounds = workoutHistory.reduce(
    (sum, workout) => sum + workout.rounds,
    0
  );

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
          paddingBottom: insets.bottom + 80,
        }}
      >
        <View className="px-6 mb-8">
          <Text className="text-4xl font-black text-white mb-2">Profile</Text>
          <Text className="text-lg text-boxing-gold">
            Manage your training preferences
          </Text>
        </View>

        {/* Boxing Level Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Boxing Level
          </Text>
          <View className="bg-boxing-cardBg border-2 border-boxing-red rounded-2xl p-5">
            {!isEditingLevel ? (
              <>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-2xl font-bold text-white">
                    {levels.find((l) => l.value === boxingLevel)?.title}
                  </Text>
                  {/* Minimalist boxing icon */}
                  <View className="w-10 h-10 rounded-full border-2 border-boxing-red items-center justify-center">
                    <View className="w-6 h-6 rounded-full bg-boxing-red opacity-80" />
                  </View>
                </View>
                <Text className="text-base text-gray-400 mb-4">
                  {levels.find((l) => l.value === boxingLevel)?.description}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsEditingLevel(true);
                  }}
                  className="active:opacity-80"
                >
                  <View
                    style={{ backgroundColor: '#000000', borderRadius: 12, padding: 14 }}
                  >
                    <Text className="text-center text-white font-bold text-base">
                      Change Level
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : (
              <View className="space-y-3">
                {levels.map((level) => (
                  <Pressable
                    key={level.value}
                    onPress={() => handleLevelChange(level.value)}
                    className="active:opacity-90"
                  >
                    <View
                      className={`border-2 rounded-xl p-4 ${
                        boxingLevel === level.value
                          ? "border-boxing-red bg-boxing-red/10"
                          : "border-boxing-cardBorder"
                      }`}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-lg font-bold text-white">
                          {level.title}
                        </Text>
                        {boxingLevel === level.value && (
                          <Text className="text-xl text-boxing-red font-bold">✓</Text>
                        )}
                      </View>
                      <Text className="text-sm text-gray-400">
                        {level.description}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsEditingLevel(false);
                  }}
                  className="active:opacity-80 mt-2"
                >
                  <View className="border border-gray-600 rounded-xl p-3">
                    <Text className="text-center text-gray-400 font-semibold">
                      Cancel
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Streaks Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Your Streak
          </Text>
          <View className="bg-gradient-to-r from-boxing-red/20 to-boxing-gold/20 border-2 border-boxing-red rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-boxing-gold text-sm mb-1 uppercase tracking-wider">Current Streak</Text>
                <View className="flex-row items-end">
                  <Text className="text-5xl font-black text-boxing-red">
                    {currentStreak}
                  </Text>
                  <Text className="text-2xl font-bold text-boxing-red ml-2 mb-1 uppercase">
                    DAYS
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs mt-1">
                  {currentStreak === 0 ? "Start your streak today!" : 
                   currentStreak === 1 ? "Keep going!" : 
                   "days in a row"}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-boxing-gold text-sm mb-1 uppercase tracking-wider">Best Streak</Text>
                <Text className="text-3xl font-black text-boxing-gold">
                  {longestStreak}
                </Text>
                <Text className="text-boxing-gold text-xs mt-1 uppercase">days</Text>
              </View>
            </View>
            {currentStreak >= 3 && (
              <View className="bg-black/30 rounded-xl p-3">
                <Text className="text-center text-boxing-gold text-sm font-semibold">
                  Amazing! Keep your streak alive by training daily!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Training Stats
          </Text>
          <View className="flex-row space-x-3">
            <View className="flex-1 bg-boxing-cardBg border-2 border-boxing-red rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-red mb-1">
                {totalWorkouts}
              </Text>
              <Text className="text-sm text-boxing-gold uppercase tracking-wider">
                Workout{totalWorkouts !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="flex-1 bg-boxing-cardBg border-2 border-boxing-red rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-red mb-1">
                {totalRounds}
              </Text>
              <Text className="text-sm text-boxing-gold uppercase tracking-wider">
                Round{totalRounds !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="flex-1 bg-boxing-cardBg border-2 border-boxing-red rounded-2xl p-4">
              <Text className="text-3xl font-black text-boxing-red mb-1">
                {Math.floor(totalDuration / 60)}
              </Text>
              <Text className="text-sm text-boxing-gold uppercase tracking-wider">Minutes</Text>
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-white mb-4">
            Achievements
          </Text>
          <View className="space-y-3">
            {ACHIEVEMENTS.slice(0, 6).map((achievement) => {
              const isUnlocked = unlockedAchievements.includes(achievement.id);
              const progress = getAchievementProgress(achievement.id, workoutHistory, currentStreak);
              const progressPercent = Math.min((progress.current / progress.target) * 100, 100);

              return (
                <View
                  key={achievement.id}
                  className={`rounded-2xl p-4 border-2 ${
                    isUnlocked
                      ? "bg-boxing-red/10 border-boxing-red"
                      : "bg-boxing-cardBg border-boxing-cardBorder"
                  }`}
                >
                  <View className="flex-row items-center mb-2">
                    {/* Achievement icon badge */}
                    <View className={`w-10 h-10 rounded-full mr-3 items-center justify-center border-2 ${
                      isUnlocked ? "border-boxing-red bg-boxing-red/20" : "border-gray-600 bg-gray-800"
                    }`}>
                      <Text className={`text-xs font-black ${isUnlocked ? "text-boxing-red" : "text-gray-600"}`}>{achievement.icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`text-lg font-bold ${isUnlocked ? "text-white" : "text-gray-500"}`}>
                        {achievement.title}
                      </Text>
                      <Text className={`text-sm ${isUnlocked ? "text-gray-300" : "text-gray-600"}`}>
                        {achievement.description}
                      </Text>
                    </View>
                    {isUnlocked && (
                      <Text className="text-2xl text-boxing-red font-black">✓</Text>
                    )}
                    {achievement.isPremium && !isUnlocked && (
                      <View className="bg-boxing-gold/20 px-2 py-1 rounded">
                        <Text className="text-xs text-boxing-gold font-bold">PRO</Text>
                      </View>
                    )}
                  </View>
                  {!isUnlocked && (
                    <View className="mt-2">
                      <View className="h-2 bg-black/30 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-boxing-red rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </View>
                      <Text className="text-xs text-boxing-gold mt-1">
                        {progress.current} / {progress.target}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Workout History Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-white">
              Workout History
            </Text>
            {workoutHistory.length > 0 && (
              <Pressable
                onPress={handleClearHistory}
                className="active:opacity-70"
              >
                <Text className="text-sm text-boxing-red font-semibold">
                  Clear All
                </Text>
              </Pressable>
            )}
          </View>

          {workoutHistory.length === 0 ? (
            <View className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-2xl p-8">
              <Text className="text-center text-gray-400 text-base">
                No workouts completed yet
              </Text>
              <Text className="text-center text-gray-500 text-sm mt-2">
                Complete your first workout to see it here!
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {workoutHistory.slice(0, 10).map((workout, index) => (
                <View
                  key={workout.id}
                  className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-xl p-4"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-bold text-white">
                      Workout #{workoutHistory.length - index}
                    </Text>
                    <View className="bg-boxing-gold/20 px-3 py-1 rounded-full">
                      <Text className="text-xs font-semibold text-boxing-gold">
                        {workout.rounds} rounds
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center space-x-4">
                    <Text className="text-sm text-gray-400">
                      {Math.floor(workout.duration / 60)} min
                    </Text>
                    <Text className="text-gray-600">•</Text>
                    <Text className="text-sm text-gray-400">
                      {new Date(workout.completedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
              {workoutHistory.length > 10 && (
                <Text className="text-center text-gray-500 text-sm mt-2">
                  Showing 10 most recent workouts
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Account Actions Section */}
        <View className="px-6 mb-6 mt-8">
          <Text className="text-xl font-bold text-white mb-4">
            Account
          </Text>

          {isAnonymous ? (
            <>
              <Text className="text-gray-400 text-sm mb-3">
                You are using PunchPal as a guest. Create an account to sync your progress across devices.
              </Text>
              <Pressable
                onPress={handleSignInPress}
                className="active:opacity-80 mb-3"
              >
                <View className="bg-black border-2 border-boxing-red rounded-xl py-4 px-6">
                  <Text className="text-boxing-red text-center text-base font-bold uppercase tracking-wider">
                    Create Account / Sign In
                  </Text>
                </View>
              </Pressable>
            </>
          ) : (
            <>
              {userEmail && (
                <Text className="text-gray-400 text-sm mb-3">
                  Signed in as {userEmail}
                </Text>
              )}
              <Pressable
                onPress={handleSignOut}
                className="active:opacity-80 mb-3"
              >
                <View className="bg-black border-2 border-boxing-gold rounded-xl py-4 px-6">
                  <Text className="text-boxing-gold text-center text-base font-bold uppercase tracking-wider">
                    Sign Out
                  </Text>
                </View>
              </Pressable>
            </>
          )}

          {/* Delete Account Button */}
          <Pressable
            onPress={handleDeleteAccount}
            className="active:opacity-80 mb-4"
          >
            <View className="bg-black border-2 border-boxing-red rounded-xl py-4 px-6">
              <Text className="text-boxing-red text-center text-base font-bold uppercase tracking-wider">
                Delete Account
              </Text>
            </View>
          </Pressable>

          <Text className="text-gray-500 text-xs text-center mb-6">
            Deleting your account will permanently remove all your data
          </Text>

          {/* Privacy Policy Button */}
          <Pressable
            onPress={handleOpenPrivacyPolicy}
            className="active:opacity-80 mb-3"
          >
            <View className="bg-black border border-gray-600 rounded-xl py-3 px-6">
              <Text className="text-gray-400 text-center text-sm font-semibold">
                Privacy Policy
              </Text>
            </View>
          </Pressable>

          {/* Support Button */}
          <Pressable
            onPress={handleOpenSupport}
            className="active:opacity-80"
          >
            <View className="bg-black border border-gray-600 rounded-xl py-3 px-6">
              <Text className="text-gray-400 text-center text-sm font-semibold">
                Support
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
