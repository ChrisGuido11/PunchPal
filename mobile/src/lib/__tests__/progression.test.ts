import { describe, expect, test } from "bun:test";
import {
  computeProgression,
  pointsForOutcome,
  previousLevel,
  type ProgressionInput,
  type RatingOutcome,
} from "../progression";

const baseInput = (
  overrides: Partial<ProgressionInput> = {}
): ProgressionInput => ({
  currentLevel: "beginner",
  currentProgress: 0,
  outcome: "just_right",
  levelCapStayingSince: null,
  levelCapTooEasyCountSinceStay: 0,
  demotionWindow: [],
  ...overrides,
});

describe("pointsForOutcome", () => {
  test("returns spec values", () => {
    expect(pointsForOutcome("too_easy")).toBe(15);
    expect(pointsForOutcome("just_right")).toBe(10);
    expect(pointsForOutcome("too_hard")).toBe(5);
    expect(pointsForOutcome("skipped")).toBe(8);
    expect(pointsForOutcome("early_exit")).toBe(2);
  });
});

describe("previousLevel", () => {
  test("intermediate -> beginner; advanced -> intermediate; beginner -> null", () => {
    expect(previousLevel("intermediate")).toBe("beginner");
    expect(previousLevel("advanced")).toBe("intermediate");
    expect(previousLevel("beginner")).toBeNull();
  });
});

describe("computeProgression — basic accumulation", () => {
  test("brand-new beginner + Just Right → progress 10, no celebration", () => {
    const r = computeProgression(baseInput({ outcome: "just_right" }));
    expect(r.newProgress).toBe(10);
    expect(r.shouldShowCelebration).toBe(false);
    expect(r.shouldShowDemotionHint).toBe(false);
    expect(r.newLevelIfAdvancing).toBeNull();
  });

  test("beginner at 90 + Just Right → 100, celebration true", () => {
    const r = computeProgression(
      baseInput({ currentProgress: 90, outcome: "just_right" })
    );
    expect(r.newProgress).toBe(100);
    expect(r.shouldShowCelebration).toBe(true);
    expect(r.newLevelIfAdvancing).toBe("intermediate");
  });

  test("intermediate at 90 + Just Right → 100, celebration true, newLevel=advanced", () => {
    const r = computeProgression(
      baseInput({
        currentLevel: "intermediate",
        currentProgress: 90,
        outcome: "just_right",
      })
    );
    expect(r.shouldShowCelebration).toBe(true);
    expect(r.newLevelIfAdvancing).toBe("advanced");
  });

  test("advanced at 90 + Just Right → 100, NO celebration ever", () => {
    const r = computeProgression(
      baseInput({
        currentLevel: "advanced",
        currentProgress: 90,
        outcome: "just_right",
      })
    );
    expect(r.newProgress).toBe(100);
    expect(r.shouldShowCelebration).toBe(false);
    expect(r.newLevelIfAdvancing).toBeNull();
  });

  test("advanced at 100 + Too Easy → still 100, no celebration", () => {
    const r = computeProgression(
      baseInput({
        currentLevel: "advanced",
        currentProgress: 100,
        outcome: "too_easy",
      })
    );
    expect(r.newProgress).toBe(100);
    expect(r.shouldShowCelebration).toBe(false);
  });

  test("early-exit adds only +2 regardless of context", () => {
    expect(
      computeProgression(baseInput({ outcome: "early_exit" })).newProgress
    ).toBe(2);
    expect(
      computeProgression(
        baseInput({ currentProgress: 50, outcome: "early_exit" })
      ).newProgress
    ).toBe(52);
  });

  test("skipped adds +8", () => {
    expect(
      computeProgression(baseInput({ outcome: "skipped" })).newProgress
    ).toBe(8);
  });

  test("too_easy adds +15", () => {
    expect(
      computeProgression(baseInput({ outcome: "too_easy" })).newProgress
    ).toBe(15);
  });

  test("too_hard adds +5", () => {
    expect(
      computeProgression(baseInput({ outcome: "too_hard" })).newProgress
    ).toBe(5);
  });
});

describe("computeProgression — cap-state Stay path", () => {
  test("Staying user + Too Easy once: count=1, no celebration, pinned at 100", () => {
    const r = computeProgression(
      baseInput({
        currentProgress: 100,
        outcome: "too_easy",
        levelCapStayingSince: "2026-05-21T00:00:00Z",
        levelCapTooEasyCountSinceStay: 0,
      })
    );
    expect(r.newProgress).toBe(100);
    expect(r.newLevelCapTooEasyCount).toBe(1);
    expect(r.shouldShowCelebration).toBe(false);
  });

  test("Staying user, third Too Easy → celebration re-fires", () => {
    const r = computeProgression(
      baseInput({
        currentProgress: 100,
        outcome: "too_easy",
        levelCapStayingSince: "2026-05-21T00:00:00Z",
        levelCapTooEasyCountSinceStay: 2,
      })
    );
    expect(r.newLevelCapTooEasyCount).toBe(3);
    expect(r.shouldShowCelebration).toBe(true);
    expect(r.newLevelIfAdvancing).toBe("intermediate");
  });

  test("Staying user + Just Right does not increment count", () => {
    const r = computeProgression(
      baseInput({
        currentProgress: 100,
        outcome: "just_right",
        levelCapStayingSince: "2026-05-21T00:00:00Z",
        levelCapTooEasyCountSinceStay: 1,
      })
    );
    expect(r.newLevelCapTooEasyCount).toBe(1);
    expect(r.shouldShowCelebration).toBe(false);
    expect(r.newProgress).toBe(100); // pinned
  });

  test("Staying user re-prompt doesn't fire again once count is already at threshold", () => {
    // Count already 3 and user rates Too Easy again — no double-fire.
    const r = computeProgression(
      baseInput({
        currentProgress: 100,
        outcome: "too_easy",
        levelCapStayingSince: "2026-05-21T00:00:00Z",
        levelCapTooEasyCountSinceStay: 3,
      })
    );
    expect(r.shouldShowCelebration).toBe(false);
  });
});

describe("computeProgression — demotion hint", () => {
  test("intermediate user with 3 too_hard in last 5 → hint TRUE", () => {
    const window: RatingOutcome[] = [
      "too_hard",
      "too_easy",
      "too_hard",
      "just_right",
    ];
    const r = computeProgression(
      baseInput({
        currentLevel: "intermediate",
        currentProgress: 30,
        outcome: "too_hard",
        demotionWindow: window,
      })
    );
    expect(r.newDemotionWindow).toEqual([
      "too_hard",
      "too_easy",
      "too_hard",
      "just_right",
      "too_hard",
    ]);
    expect(r.shouldShowDemotionHint).toBe(true);
  });

  test("intermediate user with only 2 too_hard in last 5 → hint FALSE", () => {
    const window: RatingOutcome[] = [
      "too_hard",
      "just_right",
      "just_right",
      "just_right",
    ];
    const r = computeProgression(
      baseInput({
        currentLevel: "intermediate",
        outcome: "too_hard",
        demotionWindow: window,
      })
    );
    expect(r.shouldShowDemotionHint).toBe(false);
  });

  test("beginner user is NEVER shown demotion hint (no level below)", () => {
    const window: RatingOutcome[] = [
      "too_hard",
      "too_hard",
      "too_hard",
      "too_hard",
    ];
    const r = computeProgression(
      baseInput({
        currentLevel: "beginner",
        outcome: "too_hard",
        demotionWindow: window,
      })
    );
    expect(r.shouldShowDemotionHint).toBe(false);
  });

  test("demotion window slides — keeps last 5 entries only", () => {
    const window: RatingOutcome[] = [
      "just_right",
      "just_right",
      "just_right",
      "just_right",
      "just_right",
    ];
    const r = computeProgression(
      baseInput({
        currentLevel: "intermediate",
        outcome: "too_easy",
        demotionWindow: window,
      })
    );
    expect(r.newDemotionWindow.length).toBe(5);
    expect(r.newDemotionWindow[4]).toBe("too_easy");
    expect(r.newDemotionWindow[0]).toBe("just_right"); // earliest just_right rolled off
  });
});

describe("computeProgression — interactions", () => {
  test("non-staying user crossing 100 with too_easy → celebration", () => {
    const r = computeProgression(
      baseInput({ currentProgress: 90, outcome: "too_easy" })
    );
    expect(r.newProgress).toBe(105);
    expect(r.shouldShowCelebration).toBe(true);
    expect(r.newLevelIfAdvancing).toBe("intermediate");
  });

  test("staying user + too_hard does NOT increment count nor pin off", () => {
    const r = computeProgression(
      baseInput({
        currentProgress: 100,
        outcome: "too_hard",
        levelCapStayingSince: "2026-05-21T00:00:00Z",
        levelCapTooEasyCountSinceStay: 1,
      })
    );
    expect(r.newProgress).toBe(100); // pinned
    expect(r.newLevelCapTooEasyCount).toBe(1); // unchanged
    expect(r.shouldShowCelebration).toBe(false);
  });

  test("celebration not triggered when already at 100 (no crossing)", () => {
    const r = computeProgression(
      baseInput({ currentProgress: 100, outcome: "too_easy" })
    );
    // Not staying, beginner at 100 already would never happen organically
    // (advancing or staying flow runs at the moment it crosses), but verify
    // that idempotence: re-running with currentProgress=100 produces no
    // duplicate celebration unless cap-state path applies.
    expect(r.shouldShowCelebration).toBe(false);
  });
});
