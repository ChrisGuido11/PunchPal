import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATION_KEY = "punchpal-notifications-scheduled";

// Ensures daily reminder is scheduled at 9:00 AM local time
export async function ensureDailyReminder(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_KEY);
    if (stored) return true;

    let settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      settings = await Notifications.requestPermissionsAsync();
    }

    if (!settings.granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to train 🥊",
        body: "Keep your streak alive. Knock out a round today!",
      },
      trigger: {
        type: SchedulableTriggerInputTypes.CALENDAR,
        hour: 9,
        minute: 0,
        repeats: true,
      },
    });

    await AsyncStorage.setItem(NOTIFICATION_KEY, "1");
    return true;
  } catch (error) {
    console.error("Failed to schedule notifications", error);
    return false;
  }
}
