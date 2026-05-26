// Foreground/background task wrapper. Keeps JS alive on Android while a
// workout is running, via a foreground service + persistent notification.
// iOS relies on the audio session (Audio.setAudioModeAsync staysActiveInBackground)
// plus UIBackgroundModes: audio for background continuity; this library is a
// no-op safety net there.
//
// Conditional require pattern (same as ads.ts) so Expo Go (which lacks the
// native module) doesn't crash on import.

type BackgroundServiceModule = {
  start: (task: (args: Record<string, unknown>) => Promise<void>, options: BackgroundOptions) => Promise<void>;
  stop: () => Promise<void>;
  updateNotification: (options: Partial<BackgroundOptions>) => Promise<void>;
  isRunning: () => boolean;
};

type BackgroundOptions = {
  taskName: string;
  taskTitle: string;
  taskDesc: string;
  taskIcon: { name: string; type: string };
  color?: string;
  linkingURI?: string;
  parameters?: Record<string, unknown>;
};

let BackgroundService: BackgroundServiceModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BackgroundService = require("react-native-background-actions").default as BackgroundServiceModule;
} catch {
  BackgroundService = null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The "task" itself is a no-op heartbeat — the actual workout logic runs in
// the React component. We just need SOMETHING running so the OS keeps the
// process alive and the foreground service notification stays visible.
const heartbeat = async () => {
  if (!BackgroundService) return;
  while (BackgroundService.isRunning()) {
    await sleep(15000);
  }
};

const baseOptions: BackgroundOptions = {
  taskName: "PunchPalWorkout",
  taskTitle: "PunchPal workout in progress",
  taskDesc: "Coach is calling combos",
  taskIcon: { name: "ic_launcher", type: "mipmap" },
  color: "#000000",
  linkingURI: "punchpal://",
};

export const isBackgroundTaskAvailable = (): boolean => BackgroundService !== null;

export async function startWorkoutBackgroundTask(): Promise<void> {
  if (!BackgroundService) return;
  if (BackgroundService.isRunning()) return;
  try {
    await BackgroundService.start(heartbeat, baseOptions);
  } catch {
    // Silent — workout still continues in foreground.
  }
}

export async function updateWorkoutBackgroundTask(
  taskDesc: string
): Promise<void> {
  if (!BackgroundService) return;
  if (!BackgroundService.isRunning()) return;
  try {
    await BackgroundService.updateNotification({ taskDesc });
  } catch {
    // Silent.
  }
}

export async function stopWorkoutBackgroundTask(): Promise<void> {
  if (!BackgroundService) return;
  if (!BackgroundService.isRunning()) return;
  try {
    await BackgroundService.stop();
  } catch {
    // Silent.
  }
}
