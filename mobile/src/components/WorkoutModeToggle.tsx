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
  classic: "Classic — one combo with form coaching",
  dynamic: "Dynamic — combos rotate, simulates pad work",
};

type Props = {
  disabled?: boolean;
};

export default function WorkoutModeToggle({ disabled = false }: Props) {
  const workoutMode = useUserStore((s) => s.workoutMode);
  const setWorkoutMode = useUserStore((s) => s.setWorkoutMode);

  const handleSelect = (mode: WorkoutMode) => {
    if (disabled) return;
    if (mode === workoutMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkoutMode(mode);
  };

  return (
    <View className="mx-6 mt-2 mb-2" style={{ opacity: disabled ? 0.5 : 1 }}>
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
        className="text-white/60 mt-1 text-center"
        style={{ fontSize: 11 }}
        numberOfLines={1}
      >
        {HELPER_COPY[workoutMode]}
      </Text>
    </View>
  );
}
