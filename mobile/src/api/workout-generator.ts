import { supabase, isSupabaseEnabled } from "../lib/supabaseClient";
import { BoxingLevel, WorkoutPlan, WorkoutType } from "../types/workout";
import { getUserStats, getWorkoutHistory } from "./database-service";

const fallbackWorkouts: Record<BoxingLevel, WorkoutPlan[]> = {
  beginner: [
    {
      id: "fallback-beginner-1",
      name: "Foundation Builder",
      duration: 20,
      rounds: 6,
      difficulty: "beginner",
      type: "power",
      combos: [
        { name: "The Classic", description: "Start in stance, snap out a quick jab then follow with a powerful cross. Keep your guard up after each punch.", notation: "1-2" },
        { name: "Double Tap", description: "Throw two quick jabs to establish range, then finish with a hard cross. Stay light on your feet.", notation: "1-1-2" },
        { name: "Hook Finish", description: "Jab to create opening, cross to the chin, then rotate your hips for a lead hook. Return to guard.", notation: "1-2-3" },
        { name: "Power Cross", description: "Single cross with full hip rotation. Focus on form and power over speed. Reset your stance after.", notation: "2" },
        { name: "Triple Threat", description: "Jab, cross, then a second cross. Really sit down on that last punch. Keep breathing.", notation: "1-2-2" },
        { name: "Jab Machine", description: "Three quick jabs in succession. Focus on speed and snapping your arm back each time.", notation: "1-1-1" },
      ],
      generatedAt: new Date(),
    },
    {
      id: "fallback-beginner-2",
      name: "Basics Mastery",
      duration: 18,
      rounds: 5,
      difficulty: "beginner",
      type: "power",
      combos: [
        { name: "Starter Combo", description: "Lead with a sharp jab then throw your cross with power. Focus on balance.", notation: "1-2" },
        { name: "Hook Entry", description: "Jab to set up, then throw a compact lead hook. Pivot on your front foot.", notation: "1-3" },
        { name: "Cross Hook", description: "Powerful cross then immediately follow with lead hook. Keep your chin tucked.", notation: "2-3" },
        { name: "Basic Flow", description: "Jab, cross, lead hook in one smooth motion. Stay relaxed between punches.", notation: "1-2-3" },
        { name: "Double Cross", description: "Cross, reset, cross again. Focus on technique and hip rotation each time.", notation: "2-2" },
      ],
      generatedAt: new Date(),
    },
  ],
  intermediate: [
    {
      id: "fallback-intermediate-1",
      name: "Combination Flow",
      duration: 30,
      rounds: 10,
      difficulty: "intermediate",
      type: "power",
      combos: [
        { name: "Four Piece", description: "Jab, cross, lead hook, cross. Flow through each punch with rhythm. Mix levels.", notation: "1-2-3-2" },
        { name: "Uppercut Entry", description: "Jab to create opening, rear uppercut up the middle, lead hook to exit.", notation: "1-6-3" },
        { name: "Body Breaker", description: "Jab high, cross to the body, lead hook to the head. Change levels smoothly.", notation: "1-2b-3" },
        { name: "Hook City", description: "Lead hook, cross, lead hook, cross. Keep the hooks tight and powerful.", notation: "3-2-3-2" },
        { name: "Angle Attack", description: "Jab, step left, cross, lead hook, rear uppercut. Work the angles.", notation: "1-2-3-6" },
        { name: "Speed Burst", description: "Double jab, cross, lead uppercut, cross. Fast hands, power finish.", notation: "1-1-2-5-2" },
        { name: "Counter Flow", description: "Slip right, cross, lead hook, cross. Defense into offense.", notation: "2-3-2" },
        { name: "Pressure Combo", description: "Jab, jab, rear uppercut, lead hook, cross. Push forward with each punch.", notation: "1-1-6-3-2" },
      ],
      generatedAt: new Date(),
    },
  ],
  advanced: [
    {
      id: "fallback-advanced-1",
      name: "Fight Simulation",
      duration: 40,
      rounds: 12,
      difficulty: "advanced",
      type: "power",
      combos: [
        { name: "Championship Combo", description: "Jab, cross, lead uppercut, cross, lead hook, rear uppercut. Full arsenal display.", notation: "1-2-5-2-3-6" },
        { name: "Pressure Fighter", description: "Lead hook, rear uppercut, lead hook, cross, jab, cross. Constant pressure.", notation: "3-6-3-2-1-2" },
        { name: "Counter Puncher", description: "Slip left, jab, cross, lead hook, step right, cross. Defense to offense.", notation: "1-2-3-2" },
        { name: "Body Snatcher", description: "Jab high, cross body, lead hook body, rear uppercut, cross. Multi-level attack.", notation: "1-2b-3b-6-2" },
        { name: "Angles Master", description: "Jab, pivot left, cross, lead hook, pivot right, rear hook, cross. Work all angles.", notation: "1-2-3-4-2" },
        { name: "Finisher Combo", description: "Double jab, cross, lead uppercut, rear uppercut, lead hook, cross. The knockout sequence.", notation: "1-1-2-5-6-3-2" },
        { name: "Speed Demon", description: "Triple jab, cross, lead hook, cross, rear uppercut. Overwhelming volume.", notation: "1-1-1-2-3-2-6" },
        { name: "Power Shots", description: "Rear uppercut, lead hook, cross, lead hook, rear hook. All power punches.", notation: "6-3-2-3-4" },
        { name: "Ring General", description: "Jab, feint, cross, slip right, lead hook, cross, pivot, jab. Complete boxing.", notation: "1-2-3-2-1" },
        { name: "Southpaw Destroyer", description: "Jab to body, cross, rear uppercut, cross, lead hook. Anti-southpaw sequence.", notation: "1b-2-6-2-3" },
      ],
      generatedAt: new Date(),
    },
  ],
};

function getRandomFallbackWorkout(level: BoxingLevel): WorkoutPlan {
  const workouts = fallbackWorkouts[level];
  const randomIndex = Math.floor(Math.random() * workouts.length);
  const workout = { ...workouts[randomIndex] };
  workout.combos = [...workouts[randomIndex].combos];
  workout.id = `workout-${Date.now()}`;
  workout.generatedAt = new Date();
  return workout;
}

type GeneratedWorkoutResponse = {
  name: string;
  duration: number;
  rounds: number;
  combos: { name: string; description: string; notation: string }[];
};

export async function generateWorkout(
  boxingLevel: BoxingLevel,
  workoutHistory: number,
  workoutType: WorkoutType = "power",
  userId?: string | null
): Promise<WorkoutPlan> {
  if (!isSupabaseEnabled()) {
    return getRandomFallbackWorkout(boxingLevel);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      return getRandomFallbackWorkout(boxingLevel);
    }
  }

  let userStats = null;
  let recentSessions: {
    workoutName: string;
    difficulty: BoxingLevel;
    workoutType?: WorkoutType;
    completedAt: string;
    difficultyRating?: number;
  }[] = [];
  if (userId) {
    userStats = await getUserStats(userId);
    const history = await getWorkoutHistory(userId, 5);
    recentSessions = history.map((s) => ({
      workoutName: s.workoutName,
      difficulty: s.difficulty,
      completedAt: s.completedAt,
      difficultyRating: s.difficultyRating,
    }));
  }

  try {
    const { data, error } = await supabase.functions.invoke<GeneratedWorkoutResponse>(
      "punchpal-generate-workout",
      {
        body: {
          boxingLevel,
          workoutType,
          workoutHistory,
          userStats,
          recentSessions,
        },
      }
    );

    if (error || !data || !data.combos) {
      return getRandomFallbackWorkout(boxingLevel);
    }

    return {
      id: `workout-${Date.now()}`,
      name: data.name,
      duration: data.duration,
      rounds: data.rounds,
      difficulty: boxingLevel,
      type: workoutType,
      combos: data.combos,
      generatedAt: new Date(),
    };
  } catch {
    return getRandomFallbackWorkout(boxingLevel);
  }
}
