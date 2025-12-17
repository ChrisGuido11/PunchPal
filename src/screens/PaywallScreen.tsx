import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  getPackage,
  purchasePackage,
  isRevenueCatEnabled,
  type PurchasesPackage,
} from "../lib/revenuecatClient";

type RootStackParamList = {
  Paywall: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    loadPackage();
  }, []);

  const loadPackage = async () => {
    setIsLoading(true);
    const result = await getPackage("$rc_monthly");
    if (result.ok && result.data) {
      setMonthlyPackage(result.data);
    }
    setIsLoading(false);
  };

  const handlePurchase = async () => {
    if (!monthlyPackage) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPurchasing(true);

    const result = await purchasePackage(monthlyPackage);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Purchase Failed",
        "Unable to complete purchase. Please try again.",
      );
    }

    setIsPurchasing(false);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const features = [
    "Unlimited fresh workout generation",
    "Advanced AI-powered training plans",
    "Personalized technique recommendations",
    "Priority support",
    "Ad-free experience",
  ];

  if (!isRevenueCatEnabled()) {
    return (
      <View className="flex-1 bg-[#000000] items-center justify-center px-6">
        <Text className="text-white text-center text-lg">
          Payments are not available on this platform
        </Text>
        <Pressable
          onPress={handleClose}
          className="mt-6 bg-white/10 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#000000", "#1A0000", "#000000"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Close Button */}
        <View className="px-6 mb-6">
          <Pressable
            onPress={handleClose}
            className="self-end bg-white/10 rounded-full p-2 active:opacity-60"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Header */}
        <View className="px-6 mb-8 items-center">
          <View className="bg-boxing-red/20 rounded-full p-4 mb-6 border-2 border-boxing-red">
            <Ionicons name="flash" size={48} color="#DC2626" />
          </View>
          <Text className="text-5xl font-black text-white text-center mb-3">
            Go Premium
          </Text>
          <Text className="text-xl text-boxing-gold text-center">
            Unlock unlimited workouts and advanced features
          </Text>
        </View>

        {/* Features */}
        <View className="px-6 mb-8">
          {features.map((feature, index) => (
            <View
              key={index}
              className="flex-row items-center mb-5 bg-white/5 rounded-2xl p-4"
            >
              <View className="bg-boxing-red/20 rounded-full p-2 mr-4 border border-boxing-red">
                <Ionicons name="checkmark" size={20} color="#DC2626" />
              </View>
              <Text className="text-white text-lg flex-1 font-medium">
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {/* Pricing Card */}
        {isLoading ? (
          <View className="mx-6 mb-8 bg-boxing-red/10 border-2 border-boxing-red rounded-3xl p-8 items-center">
            <ActivityIndicator size="large" color="#DC2626" />
          </View>
        ) : monthlyPackage ? (
          <View className="mx-6 mb-8">
            <LinearGradient
              colors={["#DC2626", "#B91C1C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 2,
              }}
            >
              <View className="bg-[#000000] rounded-[22px] p-6">
                <Text className="text-boxing-gold text-sm font-bold uppercase tracking-wider mb-2 text-center">
                  Monthly Subscription
                </Text>
                <Text className="text-white text-5xl font-black text-center mb-2">
                  {monthlyPackage.product.priceString}
                </Text>
                <Text className="text-gray-400 text-center text-sm">
                  per month • Cancel anytime
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View className="mx-6 mb-8 bg-white/5 rounded-3xl p-6">
            <Text className="text-white text-center">
              Unable to load subscription options
            </Text>
          </View>
        )}

        {/* CTA Button */}
        <View className="px-6">
          <Pressable
            onPress={handlePurchase}
            disabled={!monthlyPackage || isPurchasing}
            className="active:opacity-80"
          >
            <LinearGradient
              colors={
                !monthlyPackage || isPurchasing
                  ? ["#4B5563", "#374151"]
                  : ["#DC2626", "#B91C1C"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 24,
              }}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-center text-xl font-black uppercase tracking-wider">
                  Start Premium Now
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Footer */}
        <View className="px-6 mt-6">
          <Text className="text-gray-500 text-xs text-center leading-5">
            Subscription automatically renews unless cancelled at least 24
            hours before the end of the current period. Manage subscriptions in
            your App Store settings.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
