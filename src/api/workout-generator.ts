import { getGrokClient } from "./grok";
import { BoxingLevel, WorkoutPlan, PunchCombo } from "../types/workout";

export async function generateWorkout(
  boxingLevel: BoxingLevel,
  workoutHistory: number
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

  const systemPrompt = `You are a professional boxing coach with 20+ years of experience training fighters from amateur to professional level. Create a highly specific boxing workout that PERFECTLY matches the skill level.

BOXING NOTATION (Standard):
1 = Jab, 2 = Cross, 3 = Lead Hook, 4 = Rear Hook, 5 = Lead Uppercut, 6 = Rear Uppercut

SKILL LEVEL: ${boxingLevel.toUpperCase()}

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

WORKOUT STRUCTURE:
- Duration: ${guidelines.duration}
- Rounds: ${guidelines.rounds}
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

Return ONLY valid JSON in this exact format:
{
  "name": "Workout name",
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

  const userPrompt = `Generate a ${boxingLevel} level boxing workout. User has completed ${workoutHistory} workouts before. Make this workout DISTINCTLY ${boxingLevel} level - it should be ${
    boxingLevel === "beginner" ? "simple and focused on fundamentals" :
    boxingLevel === "intermediate" ? "more complex with mixed levels and angles" :
    "advanced with complex patterns and fight scenarios"
  }.`;

  try {
    const response = await grokClient.chat.completions.create({
      model: "grok-3-fast-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Grok API");
    }

    const workoutData = JSON.parse(content);

    const workout: WorkoutPlan = {
      id: `workout-${Date.now()}`,
      name: workoutData.name,
      duration: workoutData.duration,
      rounds: workoutData.rounds,
      difficulty: boxingLevel,
      combos: workoutData.combos,
      generatedAt: new Date(),
    };

    return workout;
  } catch (error) {
    console.error("Error generating workout:", error);
    throw error;
  }
}
