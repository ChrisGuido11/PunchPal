import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { BoxingLevel } from "../types/workout";

type Props = {
  visible: boolean;
  currentLevel: BoxingLevel;
  onAdvance: () => void;
  onStay: () => void;
};

const LEVEL_LABEL: Record<BoxingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const NEXT_LEVEL: Record<BoxingLevel, BoxingLevel | null> = {
  beginner: "intermediate",
  intermediate: "advanced",
  advanced: null,
};

export default function LevelUpModal({
  visible,
  currentLevel,
  onAdvance,
  onStay,
}: Props) {
  const nextLevel = NEXT_LEVEL[currentLevel];
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      pulse.value = 1;
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
  }, [pulse, visible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (!visible || !nextLevel) return null;

  const handleAdvance = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdvance();
  };

  const handleStay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStay();
  };

  return (
    <View
      className="absolute inset-0 bg-black/90 items-center justify-center px-6"
      accessibilityViewIsModal
    >
      <View
        className="bg-[#1A1A1A] rounded-3xl w-full overflow-hidden"
        style={{ maxWidth: 400 }}
      >
        <View className="px-6 pt-8 pb-6 items-center">
          <Animated.View
            style={pulseStyle}
            className="w-20 h-20 rounded-full bg-boxing-red/20 items-center justify-center mb-5 border-2 border-boxing-red"
          >
            <Text className="text-boxing-red text-3xl font-black">
              {nextLevel === "intermediate" ? "I" : "A"}
            </Text>
          </Animated.View>
          <Text className="text-white text-2xl font-black text-center">
            You&apos;ve mastered {LEVEL_LABEL[currentLevel]}.
          </Text>
          <Text className="text-boxing-gold text-base font-semibold text-center mt-2">
            Ready for {LEVEL_LABEL[nextLevel]}?
          </Text>
        </View>

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleAdvance}
            className="active:opacity-90 mb-3"
            accessibilityRole="button"
            accessibilityLabel={`Advance to ${LEVEL_LABEL[nextLevel]}`}
          >
            <View
              style={{
                backgroundColor: "#DC2626",
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 14,
              }}
            >
              <Text className="text-white text-center text-base font-black uppercase tracking-widest">
                Advance to {LEVEL_LABEL[nextLevel]}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleStay}
            className="active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={`Stay at ${LEVEL_LABEL[currentLevel]}`}
          >
            <View
              className="border-2 border-gray-600 rounded-xl py-4 px-6"
              style={{ borderRadius: 14 }}
            >
              <Text className="text-white text-center text-base font-bold">
                Stay at {LEVEL_LABEL[currentLevel]}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
