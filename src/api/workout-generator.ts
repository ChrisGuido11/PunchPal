import { getGrokClient } from "./grok";
import { BoxingLevel, WorkoutPlan, WorkoutType } from "../types/workout";
import Constants from "expo-constants";
import { getUserStats } from "./database-service";

// Fallback workouts for when API fails
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
        { name: "Body Breaker", description: "Jab high, cross to the body, lead hook to the head. Change levels smoothly.", notation: "1-2-3" },
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
        { name: "Body Snatcher", description: "Jab high, cross body, lead hook body, rear uppercut, cross. Multi-level attack.", notation: "1-2-3-6-2" },
        { name: "Angles Master", description: "Jab, pivot left, cross, lead hook, pivot right, rear hook, cross. Work all angles.", notation: "1-2-3-4-2" },
        { name: "Finisher Combo", description: "Double jab, cross, lead uppercut, rear uppercut, lead hook, cross. The knockout sequence.", notation: "1-1-2-5-6-3-2" },
        { name: "Speed Demon", description: "Triple jab, cross, lead hook, cross, rear uppercut. Overwhelming volume.", notation: "1-1-1-2-3-2-6" },
        { name: "Power Shots", description: "Rear uppercut, lead hook, cross, lead hook, rear hook. All power punches.", notation: "6-3-2-3-4" },
        { name: "Ring General", description: "Jab, feint, cross, slip right, lead hook, cross, pivot, jab. Complete boxing.", notation: "1-2-3-2-1" },
        { name: "Southpaw Destroyer", description: "Jab to body, cross, rear uppercut, cross, lead hook. Anti-southpaw sequence.", notation: "1-2-6-2-3" },
      ],
      generatedAt: new Date(),
    },
  ],
};

function getRandomFallbackWorkout(level: BoxingLevel): WorkoutPlan {
  const workouts = fallbackWorkouts[level];
  const randomIndex = Math.floor(Math.random() * workouts.length);
  const workout = { ...workouts[randomIndex] };
  // Deep copy combos array
  workout.combos = [...workouts[randomIndex].combos];
  workout.id = `workout-${Date.now()}`;
  workout.generatedAt = new Date();
  return workout;
}

export async function generateWorkout(
  boxingLevel: BoxingLevel,
  workoutHistory: number,
  workoutType: WorkoutType = "power",
  userId?: string | null
): Promise<WorkoutPlan> {
  const grokClient = getGrokClient();

  const levelGuidelines = {
    beginner: {
      focus: "Master fundamentals, build muscle memory, establish proper form",
      combos: "2-3 punch combinations maximum. Focus on 1-2, 1-1-2, 1-2-3. Keep it simple and repetitive.",
      footwork: "Basic steps: forward/backward, side-to-side, pivot on rear foot. Always return to stance.",
      defense: "Basic head movement (slip), high guard, pull back from punches. Focus on keeping hands up.",
      intensity: "Lower intensity, longer rest between rounds (60-90 sec). Focus on form over speed.",
      duration: "15-25 minutes",
      rounds: "5-8 rounds",
      tempo: "Slower pace, emphasis on technique. Each punch thrown with intention and proper form.",
      examples: "1-2 (Jab-Cross), 1-1-2 (Double Jab-Cross), 1-2-3 (Jab-Cross-Lead Hook), 2-3-2 (Cross-Lead Hook-Cross)"
    },
    intermediate: {
      focus: "Develop combinations, increase speed and power, add footwork complexity",
      combos: "3-5 punch combinations. Mix levels (body and head). Include uppercuts and multiple hooks.",
      footwork: "Angles and lateral movement, step-in combos, circle left/right, pivot combinations with punches.",
      defense: "Roll under hooks, slip-and-counter, parry-counter, pull counters, shoulder roll basics.",
      intensity: "Moderate to high intensity, 45-60 sec rest. Mix speed rounds and power rounds.",
      duration: "25-35 minutes",
      rounds: "8-12 rounds",
      tempo: "Faster pace, fluid combinations. Start incorporating rhythm changes and feints.",
      examples: "1-2-3-2 (Jab-Cross-Lead Hook-Cross), 1-6-3-2 (Jab-Rear Uppercut-Lead Hook-Cross), 3-2-3-2 (Lead Hook-Cross-Lead Hook-Cross), 1-1-2-5-2 (Double Jab-Cross-Lead Uppercut-Cross)"
    },
    advanced: {
      focus: "Master complex patterns, explosive power, fight IQ, conditioning at fight pace",
      combos: "5-8 punch combinations with angles and levels. Advanced patterns, setups, and counters.",
      footwork: "Full ring movement, cut angles mid-combo, switch stance, slide steps, explosive directional changes.",
      defense: "Advanced countering, catch-and-counter, check hook, pull-shift, full shoulder roll, multi-punch defensive sequences.",
      intensity: "High intensity fight simulation, 30-45 sec rest. Competition pace with strategic breaks.",
      duration: "35-45 minutes",
      rounds: "10-15 rounds",
      tempo: "Variable pace - explosive bursts, calculated pressure, rhythm breaks. Simulated fight scenarios.",
      examples: "1-2-5-2-3-6 (Jab-Cross-Lead Uppercut-Cross-Lead Hook-Rear Uppercut), 3-6-3-2-1-2 (Lead Hook-Rear Uppercut-Lead Hook-Cross-Jab-Cross), 1-1-2-slip-3-2-6-3 (setup with feints and defensive moves), 2-3-2-4-2 (Cross-Lead Hook-Cross-Rear Hook-Cross)"
    }
  };

  const guidelines = levelGuidelines[boxingLevel];

  // Fetch personalized user stats from Supabase for AI personalization
  let userStats = null;
  if (userId) {
    userStats = await getUserStats(userId);
  }

  let typeGuidance = "";
  let typeDuration = "";
  let typeRounds = "";

  switch (workoutType) {
    case "quick":
      typeGuidance =
        "Focus on HIGH INTENSITY, short bursts. 15-20 minutes max. Reduce rest between rounds.";
      typeDuration = "15-20 minutes";
      typeRounds = "4-6 rounds";
      break;
    case "power":
      typeGuidance =
        "Focus on EXPLOSIVE POWER. Heavy handed combos with focus on impact. Standard rest.";
      typeDuration = guidelines.duration;
      typeRounds = guidelines.rounds;
      break;
    case "endurance":
      typeGuidance =
        "Focus on STEADY PACE, longer duration. Light combos at moderate intensity. Longer rest periods.";
      typeDuration =
        boxingLevel === "beginner"
          ? "25-35 minutes"
          : boxingLevel === "intermediate"
            ? "35-45 minutes"
            : "45-60 minutes";
      typeRounds =
        boxingLevel === "beginner"
          ? "8-10 rounds"
          : boxingLevel === "intermediate"
            ? "12-15 rounds"
            : "15-20 rounds";
      break;
    case "technique":
      typeGuidance =
        "Focus on FORM AND PRECISION. Slower pace with emphasis on correct mechanics and footwork. Lots of description.";
      typeDuration =
        boxingLevel === "beginner" ? "20-25 minutes" : boxingLevel === "intermediate" ? "30-40 minutes" : "40-50 minutes";
      typeRounds =
        boxingLevel === "beginner" ? "6-8 rounds" : boxingLevel === "intermediate" ? "10-12 rounds" : "12-15 rounds";
      break;
  }

  const systemPrompt = `You are a professional boxing coach with 20+ years of experience training fighters from amateur to professional level. Create a highly specific boxing workout that PERFECTLY matches the skill level.

BOXING NOTATION (Standard):
1 = Jab, 2 = Cross, 3 = Lead Hook, 4 = Rear Hook, 5 = Lead Uppercut, 6 = Rear Uppercut

SKILL LEVEL: ${boxingLevel.toUpperCase()}
WORKOUT TYPE: ${workoutType.toUpperCase()} - ${typeGuidance}

TRAINING PHILOSOPHY FOR THIS LEVEL:
${guidelines.focus}

COMBINATION GUIDELINES:
${guidelines.combos}

FOOTWORK INTEGRATION:
${guidelines.footwork}

DEFENSIVE TECHNIQUES TO INCLUDE:
${guidelines.defense}

INTENSITY & REST:
${guidelines.intensity}

WORKOUT STRUCTURE FOR ${workoutType.toUpperCase()}:
- Duration: ${typeDuration}
- Rounds: ${typeRounds}
- Tempo: ${guidelines.tempo}

EXAMPLE COMBINATIONS FOR THIS LEVEL:
${guidelines.examples}

CRITICAL RULES:
1. Combo complexity MUST match skill level (beginners: 2-3 punches max, intermediate: 3-5, advanced: 5-8)
2. Descriptions must include footwork and defensive movements appropriate for this level
3. Each combo description should feel different and realistic for ${boxingLevel}s
4. Include body shots (add "to body" in description) for intermediate/advanced
5. Vary the combinations - don't repeat similar patterns
6. Make workout names motivating and level-appropriate
7. Workout type "${workoutType}" guidelines MUST be followed
8. WORKOUT NAME FORMAT RULE (CRITICAL): Format workout names as "TWO WORD STYLE: Rest of Name". The part before the colon MUST be exactly TWO words. Examples: "Power Rush: Build Your Stamina", "Combo Flow: Master Complex Patterns", "Speed Burst: Explosive Training". Never more than 2 words before the colon.

Return ONLY valid JSON in this exact format:
{
  "name": "Two Word Style: Rest of Name Here",
  "duration": 30,
  "rounds": 10,
  "combos": [
    {
      "name": "Combo name",
      "description": "Detailed description including footwork and defense",
      "notation": "1-2-3"
    }
  ]
}`;

  // Build personalization context from Supabase stats
  let personalizationContext = "";
  if (userStats) {
    personalizationContext = `

USER PERSONALIZATION DATA FROM SUPABASE:
- Total Training Sessions: ${userStats.totalWorkouts}
- Total Training Time: ${userStats.totalMinutes} minutes
- Current Level: ${userStats.currentLevel}
- Progress to Next Level: ${userStats.nextLevelProgress}%
- Combos Mastered: ${userStats.combosLearned}
- Current Training Streak: ${userStats.currentStreak} days
- Longest Training Streak: ${userStats.longestStreak} days
- Average Accuracy: ${userStats.avgAccuracy}%
- Last Workout: ${userStats.lastWorkoutDate || 'First workout'}

Use this data to:
1. Adjust combo complexity based on combos mastered (${userStats.combosLearned} combos)
2. Consider their accuracy (${userStats.avgAccuracy}%) - if high, add more challenge; if low, focus on fundamentals
3. Reference their streak (${userStats.currentStreak} days) - reward consistency with variety
4. Match workout difficulty to their current level (${userStats.currentLevel}) and progress (${userStats.nextLevelProgress}%)
5. If they're close to leveling up (>80%), introduce slightly harder combinations to prepare them`;
  }

  const userPrompt = `Generate a ${boxingLevel} level boxing workout. User has completed ${workoutHistory} workouts before. Make this workout DISTINCTLY ${boxingLevel} level - it should be ${
    boxingLevel === "beginner" ? "simple and focused on fundamentals" :
    boxingLevel === "intermediate" ? "more complex with mixed levels and angles" :
    "advanced with complex patterns and fight scenarios"
  }.${personalizationContext}`;

  try {
    // Check if API key is available before making the request
    const apiKeyAvailable =
      Constants.expoConfig?.extra?.grokApiKey ||
      process.env.GROK_API_KEY ||
      process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY;

    if (!apiKeyAvailable) {
      console.log("Grok API key not available, using fallback workout");
      return getRandomFallbackWorkout(boxingLevel);
    }

    const response = await grokClient.chat.completions.create({
      model: "grok-4-fast-non-reasoning",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log("No response from Grok API, using fallback workout");
      return getRandomFallbackWorkout(boxingLevel);
    }

    // Clean the response - extract JSON from potential markdown code blocks
    let cleanContent = content.trim();

    // Remove markdown code block markers if present
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("```")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();

    // Try to extract JSON object if there's extra text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    // Fix common JSON issues from AI responses
    // Fix patterns like "reps": 10 (each side) -> "reps": "10 (each side)"
    cleanContent = cleanContent.replace(
      /:\s*(\d+)\s*\(([^)]+)\)/g,
      ': "$1 ($2)"'
    );

    let workoutData;
    try {
      workoutData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse workout JSON, using fallback:", parseError);
      return getRandomFallbackWorkout(boxingLevel);
    }

    const workout: WorkoutPlan = {
      id: `workout-${Date.now()}`,
      name: workoutData.name,
      duration: workoutData.duration,
      rounds: workoutData.rounds,
      difficulty: boxingLevel,
      type: workoutType,
      combos: workoutData.combos,
      generatedAt: new Date(),
    };

    return workout;
  } catch (error) {
    console.error("Error generating workout:", error);
    console.log("Using fallback workout due to API error");
    return getRandomFallbackWorkout(boxingLevel);
  }
}

