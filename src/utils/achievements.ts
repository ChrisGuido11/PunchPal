import { Achievement } from "../types/workout";
import { WorkoutHistory } from "../types/workout";

export const ACHIEVEMENTS: Achievement[] = [
  // Free achievements
  {
    id: "first_workout",
    title: "First Steps",
    description: "Complete your first workout",
    icon: "🥊",
    isPremium: false,
  },
  {
    id: "streak_3",
    title: "Getting Started",
    description: "3-day workout streak",
    icon: "🔥",
    isPremium: false,
  },
  {
    id: "streak_7",
    title: "Week Warrior",
    description: "7-day workout streak",
    icon: "⭐",
    isPremium: false,
  },
  {
    id: "workouts_10",
    title: "Committed Fighter",
    description: "Complete 10 workouts",
    icon: "💪",
    isPremium: false,
  },
  {
    id: "workouts_25",
    title: "Dedicated Boxer",
    description: "Complete 25 workouts",
    icon: "🏆",
    isPremium: false,
  },
  // Premium achievements
  {
    id: "streak_14",
    title: "Two Week Champion",
    description: "14-day workout streak",
    icon: "🌟",
    isPremium: true,
  },
  {
    id: "streak_30",
    title: "Monthly Master",
    description: "30-day workout streak",
    icon: "👑",
    isPremium: true,
  },
  {
    id: "workouts_50",
    title: "Boxing Elite",
    description: "Complete 50 workouts",
    icon: "💎",
    isPremium: true,
  },
  {
    id: "workouts_100",
    title: "Century Club",
    description: "Complete 100 workouts",
    icon: "🎖️",
    isPremium: true,
  },
  {
    id: "rounds_100",
    title: "Round Master",
    description: "Complete 100 rounds total",
    icon: "🥇",
    isPremium: true,
  },
  {
    id: "rounds_500",
    title: "Ring Legend",
    description: "Complete 500 rounds total",
    icon: "🔱",
    isPremium: true,
  },
  {
    id: "level_up_inter",
    title: "Leveling Up",
    description: "Advance to Intermediate level",
    icon: "📈",
    isPremium: false,
  },
  {
    id: "level_up_advanced",
    title: "Elite Fighter",
    description: "Advance to Advanced level",
    icon: "🚀",
    isPremium: true,
  },
];

export const checkAchievements = (
  workoutHistory: WorkoutHistory[],
  currentStreak: number,
  longestStreak: number,
  unlockedAchievements: string[]
): string[] => {
  const newUnlocked: string[] = [];
  const totalWorkouts = workoutHistory.length;
  const totalRounds = workoutHistory.reduce((sum, w) => sum + w.rounds, 0);

  const checks = [
    { id: "first_workout", condition: totalWorkouts >= 1 },
    { id: "streak_3", condition: currentStreak >= 3 },
    { id: "streak_7", condition: currentStreak >= 7 },
    { id: "streak_14", condition: currentStreak >= 14 },
    { id: "streak_30", condition: currentStreak >= 30 },
    { id: "workouts_10", condition: totalWorkouts >= 10 },
    { id: "workouts_25", condition: totalWorkouts >= 25 },
    { id: "workouts_50", condition: totalWorkouts >= 50 },
    { id: "workouts_100", condition: totalWorkouts >= 100 },
    { id: "rounds_100", condition: totalRounds >= 100 },
    { id: "rounds_500", condition: totalRounds >= 500 },
  ];

  checks.forEach(({ id, condition }) => {
    if (condition && !unlockedAchievements.includes(id)) {
      newUnlocked.push(id);
    }
  });

  return newUnlocked;
};

export const getAchievementProgress = (
  achievementId: string,
  workoutHistory: WorkoutHistory[],
  currentStreak: number
): { current: number; target: number } => {
  const totalWorkouts = workoutHistory.length;
  const totalRounds = workoutHistory.reduce((sum, w) => sum + w.rounds, 0);

  const progressMap: Record<string, { current: number; target: number }> = {
    first_workout: { current: totalWorkouts, target: 1 },
    streak_3: { current: currentStreak, target: 3 },
    streak_7: { current: currentStreak, target: 7 },
    streak_14: { current: currentStreak, target: 14 },
    streak_30: { current: currentStreak, target: 30 },
    workouts_10: { current: totalWorkouts, target: 10 },
    workouts_25: { current: totalWorkouts, target: 25 },
    workouts_50: { current: totalWorkouts, target: 50 },
    workouts_100: { current: totalWorkouts, target: 100 },
    rounds_100: { current: totalRounds, target: 100 },
    rounds_500: { current: totalRounds, target: 500 },
  };

  return progressMap[achievementId] || { current: 0, target: 1 };
};
