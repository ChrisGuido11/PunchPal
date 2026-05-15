import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { useUserStore } from "../state/userStore";

type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

type AuthMode = "signin" | "signup";

export default function AuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setUserId = useUserStore((s) => s.setUserId);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!isSupabaseEnabled()) {
      Alert.alert("Notice", "Supabase is not configured. Account features are disabled.");
      navigation.goBack();
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const withTimeout = <T,>(p: Promise<T>, ms = 20000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timed out. Check your connection and try again.")),
            ms,
          ),
        ),
      ]);

    try {
      let result;
      // updateUser keeps the existing anon session (in-place upgrade) and returns
      // { data: { user } } without a session field — that's still success, not a
      // pending email confirmation. Track which path we took so we can interpret
      // the response correctly.
      let isAnonUpgrade = false;

      if (mode === "signup") {
        // Use getSession() (reads cached JWT, no network) instead of getUser()
        // (server roundtrip — hangs forever if queued behind a stalled
        // signInAnonymously() call from another code path).
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUser = sessionData.session?.user;
        if (currentUser?.is_anonymous) {
          isAnonUpgrade = true;
          result = await withTimeout(supabase.auth.updateUser({ email, password }));
        } else {
          result = await withTimeout(supabase.auth.signUp({ email, password }));
        }
      } else {
        result = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
        );
      }

      if (result.error) {
        setError(result.error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Success criteria differs by path:
      // - updateUser (anon upgrade): existing session is still valid; data.session
      //   is not returned. Just having data.user means the upgrade succeeded.
      // - signUp / signInWithPassword: need BOTH user and session. If user is
      //   present but session is null, email confirmation is enabled and pending.
      const isSuccess = isAnonUpgrade
        ? !!result.data.user
        : !!(result.data.user && result.data.session);

      if (isSuccess && result.data.user) {
        useUserStore.setState({ userId: result.data.user.id });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } else if (result.data.user) {
        // Email confirmation required — user exists but no active session yet.
        setError("Check your email to confirm your account, then sign in.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setError("Something went wrong. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred. Please try again.";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
  };

  return (
    <LinearGradient colors={["#000000", "#000000"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="px-6">
          {/* Logo */}
          <View className="items-center mb-12">
            <Image
              source={require("../../assets/logo.png")}
              style={{ width: 160, height: 160, marginBottom: 20, resizeMode: "contain" }}
            />
            <Text className="text-4xl font-black text-white tracking-tight">
              PunchPal
            </Text>
            <Text className="text-boxing-gold text-sm mt-2 font-semibold">
              Your AI Boxing Coach
            </Text>
          </View>

          {/* Auth Mode Selector */}
          <View className="flex-row space-x-3 mb-8">
            <Pressable
              onPress={() => setMode("signin")}
              className="flex-1"
              disabled={isLoading}
            >
              <View
                className={`rounded-xl py-3 px-4 ${
                  mode === "signin"
                    ? "bg-black border-2 border-boxing-red"
                    : "bg-[#1A1A1A] border-2 border-gray-700"
                }`}
              >
                <Text
                  className={`text-center font-bold uppercase tracking-wider ${
                    mode === "signin" ? "text-white" : "text-gray-500"
                  }`}
                >
                  Sign In
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setMode("signup")}
              className="flex-1"
              disabled={isLoading}
            >
              <View
                className={`rounded-xl py-3 px-4 ${
                  mode === "signup"
                    ? "bg-black border-2 border-boxing-red"
                    : "bg-[#1A1A1A] border-2 border-gray-700"
                }`}
              >
                <Text
                  className={`text-center font-bold uppercase tracking-wider ${
                    mode === "signup" ? "text-white" : "text-gray-500"
                  }`}
                >
                  Sign Up
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Error Message */}
          {error && (
            <View className="bg-boxing-red/20 border-2 border-boxing-red rounded-xl p-4 mb-6">
              <Text className="text-boxing-red text-sm text-center font-semibold">
                {error}
              </Text>
            </View>
          )}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-white text-sm font-bold mb-2 uppercase tracking-wider">
              Email
            </Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-[#1A1A1A] border-2 border-gray-700 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          {/* Password Input */}
          <View className="mb-8">
            <Text className="text-white text-sm font-bold mb-2 uppercase tracking-wider">
              Password
            </Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              secureTextEntry
              className="bg-[#1A1A1A] border-2 border-gray-700 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          {/* Auth Button */}
          <Pressable
            onPress={handleAuth}
            disabled={isLoading}
            className="active:opacity-80 mb-4"
          >
            <View className="bg-black border-2 border-boxing-red rounded-xl py-4 items-center">
              {isLoading ? (
                <ActivityIndicator color="#DC2626" size="small" />
              ) : (
                <Text className="text-boxing-red text-center text-base font-bold uppercase tracking-wider">
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </View>
          </Pressable>

          {/* Toggle Auth Mode */}
          <Pressable
            onPress={toggleMode}
            disabled={isLoading}
            className="active:opacity-70"
          >
            <Text className="text-gray-400 text-center text-sm">
              {mode === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text className="text-boxing-gold font-bold">
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </Text>
            </Text>
          </Pressable>

          {/* Demo Mode Notice */}
          {!isSupabaseEnabled() && (
            <View className="mt-8 bg-[#1A1A1A] border border-boxing-gold rounded-xl p-4">
              <Text className="text-boxing-gold text-xs text-center font-semibold">
                Demo Mode: Supabase not configured. App will continue without authentication.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
