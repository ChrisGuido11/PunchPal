import { getGrokClient } from "./grok";
import { BoxingLevel, WorkoutPlan, PunchCombo } from "../types/workout";

export async function generateWorkout(
  boxingLevel: BoxingLevel,
  workoutHistory: number
): Promise<WorkoutPlan> {
  const grokClient = getGrokClient();

  const systemPrompt = `You are a professional boxing coach creating personalized workout plans. Generate a detailed boxing workout plan in JSON format based on the user's level and history.

The workout should include:
- A motivating workout name
- Duration in minutes (15-45 min based on level)
- Number of 3-minute rounds
- 8-12 punch combinations with names, descriptions, and boxing notation

Punch combinations should use standard boxing notation:
1 = Jab, 2 = Cross, 3 = Lead Hook, 4 = Rear Hook, 5 = Lead Uppercut, 6 = Rear Uppercut

Return ONLY valid JSON in this exact format:
{
  "name": "Workout name",
  "duration": 30,
  "rounds": 10,
  "combos": [
    {
      "name": "Jab-Cross",
      "description": "Basic one-two combo",
      "notation": "1-2"
    }
  ]
}`;

  const userPrompt = `Generate a ${boxingLevel} level boxing workout. User has completed ${workoutHistory} workouts before.`;

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
