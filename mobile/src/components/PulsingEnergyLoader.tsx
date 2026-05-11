import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image } from "react-native";

// State-driven breathing loop. Uses setInterval + useState to force React
// re-renders that update inline style.transform.scale — the only path that
// reliably animates on this stack (RN 0.81 + New Arch + Reanimated 4 +
// Worklets + NativeWind v4 + React 19).
export default function PulsingEnergyLoader() {
  const [, setTick] = useState(0);
  const directionRef = useRef(1);
  const phaseRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      let next = phaseRef.current + directionRef.current * 0.04;
      if (next >= 1) {
        directionRef.current = -1;
        next = 1;
      } else if (next <= 0) {
        directionRef.current = 1;
        next = 0;
      }
      phaseRef.current = next;
      setTick((t) => t + 1);
    }, 50);
    return () => clearInterval(id);
  }, []);

  const phase = phaseRef.current;
  const scale = 0.85 + phase * 0.3;
  const opacity = 0.55 + phase * 0.45;

  return (
    <View className="flex-1 items-center justify-center">
      <View style={{ marginBottom: 28, transform: [{ scale }], opacity }}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 160, height: 160 }}
          resizeMode="contain"
        />
      </View>
      <Text className="text-2xl font-bold text-white mb-2">
        Preparing Your Workout
      </Text>
      <Text className="text-base text-gray-400 text-center px-8">
        Coach is crafting your personalized training plan…
      </Text>
    </View>
  );
}
