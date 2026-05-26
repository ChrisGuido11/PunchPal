import type { BoxingLevel } from "../types/workout";

export type RatingOutcome =
  | "too_easy"
  | "just_right"
  | "too_hard"
  | "skipped"
  | "early_exit";

const POINTS: Record<RatingOutcome, number> = {
  too_easy: 15,
  just_right: 10,
  too_hard: 5,
  skipped: 8,
  early_exit: 2,
};

export function pointsForOutcome(outcome: RatingOutcome): number {
  return POINTS[outcome];
}

const NEXT_LEVEL: Record<BoxingLevel, "intermediate" | "advanced" | null> = {
  beginner: "intermediate",
  intermediate: "advanced",
  advanced: null,
};

const PREVIOUS_LEVEL: Record<BoxingLevel, BoxingLevel | null> = {
  beginner: null,
  intermediate: "beginner",
  advanced: "intermediate",
};

export function previousLevel(level: BoxingLevel): BoxingLevel | null {
  return PREVIOUS_LEVEL[level];
}

export interface ProgressionInput {
  currentLevel: BoxingLevel;
  currentProgress: number;
  outcome: RatingOutcome;
  levelCapStayingSince: string | null;
  levelCapTooEasyCountSinceStay: number;
  demotionWindow: RatingOutcome[];
}

export interface ProgressionResult {
  newProgress: number;
  shouldShowCelebration: boolean;
  shouldShowDemotionHint: boolean;
  newLevelIfAdvancing: "intermediate" | "advanced" | null;
  newLevelCapTooEasyCount: number;
  newDemotionWindow: RatingOutcome[];
}

const DEMOTION_WINDOW_SIZE = 5;
const DEMOTION_HARD_THRESHOLD = 3;
const STAY_REPROMPT_THRESHOLD = 3;

export function computeProgression(input: ProgressionInput): ProgressionResult {
  const {
    currentLevel,
    currentProgress,
    outcome,
    levelCapStayingSince,
    levelCapTooEasyCountSinceStay,
    demotionWindow,
  } = input;

  const points = pointsForOutcome(outcome);
  const isStaying = levelCapStayingSince !== null;
  const isAdvanced = currentLevel === "advanced";

  // Advance the cap-state "too easy since stay" counter when applicable.
  let newCount = levelCapTooEasyCountSinceStay;
  if (isStaying && outcome === "too_easy") {
    newCount = Math.min(STAY_REPROMPT_THRESHOLD, newCount + 1);
  }

  // Compute new progress. If user is at advanced and currently maxed, cap at 100.
  // If user is staying and threshold for re-prompt not yet reached, pin at 100.
  let newProgress = currentProgress + points;

  if (isAdvanced) {
    newProgress = Math.min(100, newProgress);
  } else if (isStaying && newCount < STAY_REPROMPT_THRESHOLD) {
    // Pinned at the cap; points are absorbed but progress stays at 100.
    newProgress = 100;
  } else {
    newProgress = Math.max(0, newProgress);
  }

  // Celebration only when crossing 100 from a non-cap state, or when the
  // re-prompt threshold is reached (newCount hit STAY_REPROMPT_THRESHOLD).
  let shouldShowCelebration = false;
  if (!isAdvanced) {
    if (isStaying) {
      // Re-prompt fires on the workout that pushes the counter to the threshold.
      if (
        outcome === "too_easy" &&
        newCount >= STAY_REPROMPT_THRESHOLD &&
        levelCapTooEasyCountSinceStay < STAY_REPROMPT_THRESHOLD
      ) {
        shouldShowCelebration = true;
      }
    } else if (newProgress >= 100 && currentProgress < 100) {
      shouldShowCelebration = true;
    }
  }

  const newLevelIfAdvancing = shouldShowCelebration
    ? NEXT_LEVEL[currentLevel]
    : null;

  // Sliding-window demotion tracker.
  const newDemotionWindow = [...demotionWindow, outcome].slice(
    -DEMOTION_WINDOW_SIZE
  );
  const tooHardCount = newDemotionWindow.filter(
    (o) => o === "too_hard"
  ).length;
  const shouldShowDemotionHint =
    currentLevel !== "beginner" && tooHardCount >= DEMOTION_HARD_THRESHOLD;

  return {
    newProgress,
    shouldShowCelebration,
    shouldShowDemotionHint,
    newLevelIfAdvancing,
    newLevelCapTooEasyCount: newCount,
    newDemotionWindow,
  };
}
