import React from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useUserStore, WorkoutMode } from "../state/userStore";

type SegmentProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Segment({ label, active, onPress }: SegmentProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} mode`}
      className={`flex-1 items-center justify-center transition-colors duration-150 ${
        active ? "bg-boxing-red" : "bg-transparent"
      }`}
      style={{ height: 36 }}
    >
      <Text
        className={`text-xs font-bold uppercase tracking-widest ${
          active ? "text-white" : "text-white/60"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const HELPER_COPY: Record<WorkoutMode, string> = {
  classic: "Classic — one combo for the whole round",
  dynamic: "Dynamic — combos rotate within each round",
};

export default function WorkoutModeToggle() {
  const workoutMode = useUserStore((s) => s.workoutMode);
  const setWorkoutMode = useUserStore((s) => s.setWorkoutMode);

  const handleSelect = (mode: WorkoutMode) => {
    if (mode === workoutMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkoutMode(mode);
  };

  return (
    <View className="mx-6 mt-3 mb-3">
      <View className="flex-row rounded-lg border border-boxing-cardBorder overflow-hidden">
        <Segment
          label="Classic"
          active={workoutMode === "classic"}
          onPress={() => handleSelect("classic")}
        />
        <Segment
          label="Dynamic"
          active={workoutMode === "dynamic"}
          onPress={() => handleSelect("dynamic")}
        />
      </View>
      <Text
        className="text-white/60 mt-2 text-center"
        style={{ fontSize: 12 }}
        numberOfLines={1}
      >
        {HELPER_COPY[workoutMode]}
      </Text>
    </View>
  );
}
