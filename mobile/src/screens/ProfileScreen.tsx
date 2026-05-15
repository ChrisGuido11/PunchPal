import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useUserStore } from "../state/userStore";
import { BoxingLevel } from "../types/workout";
import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
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

  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    let active = true;

    const applySession = (user: { email?: string | null; is_anonymous?: boolean } | null | undefined) => {
      if (!active) return;
      setUserEmail(user?.email ?? null);
      setIsAnonymous(user?.is_anonymous ?? !user?.email);
    };

    // Initial load via getSession() (cached, no server roundtrip).
    (async () => {
      const { data } = await supabase.auth.getSession();
      applySession(data.session?.user);
    })();

    // CRITICAL: do NOT call any supabase.auth.* methods inside this callback.
    // supabase-js awaits subscriber callbacks while still holding its internal
    // auth lock; calling getUser/getSession/updateUser/signOut from in here
    // causes a circular await that deadlocks signUp/updateUser/signInWithPassword
    // until our 20s withTimeout fires. Use the `session` arg directly instead.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user);
    });

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

            try {
              if (isSupabaseEnabled()) {
                // signOut() goes through the supabase-js auth lock — wrap in a
                // timeout so a hung lock doesn't block local cleanup forever.
                await Promise.race([
                  supabase.auth.signOut(),
                  new Promise((resolve) => setTimeout(resolve, 5000)),
                ]);
              }
            } catch (err) {
              console.error("signOut failed:", err);
            }

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

            const withTimeout = <T,>(p: Promise<T>, ms = 10000): Promise<T | null> =>
              Promise.race([
                p.catch((e) => {
                  console.error("delete-account call failed:", e);
                  return null as T | null;
                }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
              ]);

            let serverFailureMessage: string | null = null;

            try {
              if (isSupabaseEnabled()) {
                // Edge Function uses service-role key to delete data tables
                // AND the auth.users row. Client cannot do either directly:
                // RLS has no DELETE policy on the data tables, and only the
                // service role can call auth.admin.deleteUser().
                const result = await withTimeout(
                  supabase.functions.invoke<{
                    data_deleted: boolean;
                    auth_deleted: boolean;
                    auth_error?: string;
                    table_errors?: Record<string, string>;
                  }>("punchpal-delete-account"),
                );

                if (!result) {
                  serverFailureMessage =
                    "We couldn't reach the server to fully delete your account. You've been signed out locally — contact support if this persists.";
                } else if (result.error) {
                  console.error("delete-account invoke error:", result.error);
                  serverFailureMessage =
                    "Account deletion failed on the server. You've been signed out locally — contact support if this persists.";
                } else if (result.data && !result.data.data_deleted) {
                  console.error("delete-account partial failure:", result.data);
                  serverFailureMessage =
                    "We couldn't fully delete your account on the server. Contact support if this persists.";
                }

                // signOut clears the local AsyncStorage JWT. The auth row may
                // already be gone server-side, which is fine — signOut tolerates
                // a missing session and just clears local state.
                await withTimeout(supabase.auth.signOut());
              }
            } catch (err) {
              console.error("delete-account flow failed:", err);
              serverFailureMessage =
                "Account deletion failed on the server. You've been signed out locally — contact support if this persists.";
            }

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

            if (serverFailureMessage) {
              Alert.alert("Account Deletion", serverFailureMessage);
            }

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
      await Linking.openURL("https://punchpal-ai.lovable.app/privacy");
    } catch (error) {
      console.error("Failed to open privacy policy:", error);
    }
  };

  const handleOpenSupport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL("https://punchpal-ai.lovable.app/support");
    } catch (error) {
      console.error("Failed to open support website:", error);
    }
  };

  const handleOpenTerms = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL("https://punchpal-ai.lovable.app/terms");
    } catch (error) {
      console.error("Failed to open terms website:", error);
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
                {totalDuration}
              </Text>
              <Text className="text-sm text-boxing-gold uppercase tracking-wider">Minutes</Text>
            </View>
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
              {workoutHistory.slice(0, 10).map((workout) => (
                <View
                  key={workout.id}
                  className="bg-boxing-cardBg border-2 border-boxing-cardBorder rounded-xl p-4"
                >
                  <Text className="text-lg font-bold text-white mb-3">
                    {workout.workoutName || "Workout"}
                  </Text>
                  <View className="flex-row items-center flex-wrap">
                    <View className="bg-boxing-gold/20 px-3 py-1 rounded-full mr-3 mb-1">
                      <Text className="text-xs font-semibold text-boxing-gold">
                        {workout.rounds} rounds
                      </Text>
                    </View>
                    <Text className="text-sm text-gray-400 mr-2 mb-1">
                      {workout.duration} min
                    </Text>
                    <Text className="text-gray-600 mr-2 mb-1">•</Text>
                    <Text className="text-sm text-gray-400 mb-1">
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

          {/* Terms Button */}
          <Pressable
            onPress={handleOpenTerms}
            className="active:opacity-80 mb-3"
          >
            <View className="bg-black border border-gray-600 rounded-xl py-3 px-6">
              <Text className="text-gray-400 text-center text-sm font-semibold">
                Terms of Service
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
