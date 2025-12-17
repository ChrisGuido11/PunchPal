import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function PulsingEnergyLoader() {
  // Create three animated values for the three concentric rings
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create pulsing animation for each ring with staggered start times
    const createPulseAnimation = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all three pulse animations with staggered delays
    const animation1 = createPulseAnimation(pulse1, 0);
    const animation2 = createPulseAnimation(pulse2, 600);
    const animation3 = createPulseAnimation(pulse3, 1200);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [pulse1, pulse2, pulse3]);

  // Interpolate scale and opacity for each ring
  const createRingStyle = (pulseValue: Animated.Value) => ({
    transform: [
      {
        scale: pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 2.5],
        }),
      },
    ],
    opacity: pulseValue.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.8, 0.6, 0],
    }),
  });

  return (
    <View className="items-center justify-center py-20">
      {/* Glassmorphic background container */}
      <View className="items-center justify-center mb-8">
        <View style={styles.energyContainer}>
          {/* Ring 3 - Outermost (red) */}
          <Animated.View style={[styles.ring, createRingStyle(pulse3)]}>
            <LinearGradient
              colors={["#DC2626", "#FF0000"]}
              style={styles.ringGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* Ring 2 - Middle (red-gold blend) */}
          <Animated.View style={[styles.ring, createRingStyle(pulse2)]}>
            <LinearGradient
              colors={["#DC2626", "#D4AF37"]}
              style={styles.ringGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* Ring 1 - Innermost (gold) */}
          <Animated.View style={[styles.ring, createRingStyle(pulse1)]}>
            <LinearGradient
              colors={["#D4AF37", "#F4E5C2"]}
              style={styles.ringGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* Center core - static glow */}
          <View style={styles.centerCore}>
            <LinearGradient
              colors={["#D4AF37", "#DC2626"]}
              style={styles.coreGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </View>
      </View>

      {/* Text content */}
      <Text className="text-2xl font-bold text-white mt-4 mb-2">
        Preparing Your Workout
      </Text>
      <Text className="text-base text-gray-400 text-center px-8">
        Coach is crafting your personalized training plan...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  energyContainer: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ring: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
  },
  ringGradient: {
    flex: 1,
    borderRadius: 40,
  },
  centerCore: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 10,
  },
  coreGradient: {
    flex: 1,
    borderRadius: 12,
  },
});
