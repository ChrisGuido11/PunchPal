import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SplashScreen from "../screens/SplashScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TimerScreen from "../screens/TimerScreen";
import PaywallScreen from "../screens/PaywallScreen";
// import WorkoutLibraryScreen from "../screens/WorkoutLibraryScreen"; // TODO: enable library later

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Timer: undefined;
  Paywall: undefined;
  // Library: undefined;
};

export type TabParamList = {
  Home: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0F0F0F",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#DC2626",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: -4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "#0F0F0F" },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="Timer"
        component={TimerScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: "slide_from_bottom",
          presentation: "modal",
        }}
      />
      {/* Library screen hidden for now */}
      {/* <Stack.Screen
        name="Library"
        component={WorkoutLibraryScreen}
        options={{
          animation: "slide_from_right",
          presentation: "card",
        }}
      /> */}
    </Stack.Navigator>
  );
}
