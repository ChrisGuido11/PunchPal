import { describe, expect, test } from "bun:test";
import { expandForSpeech, generateVariations, pickDeterministic } from "../combo-variations";

const parsePunches = (notation: string): number[] => {
  if (!notation) return [];
  return notation
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = /^([1-6])b?$/i.exec(p);
      return m ? parseInt(m[1], 10) : NaN;
    });
};

describe("generateVariations", () => {
  test("deterministic for same anchor and count", () => {
    const a = generateVariations("1-2-3", 5);
    const b = generateVariations("1-2-3", 5);
    expect(a).toEqual(b);
  });

  test("returns unique variations within one call", () => {
    const result = generateVariations("1-2-3-4", 9);
    expect(new Set(result).size).toBe(result.length);
  });

  test("never returns the anchor itself", () => {
    const anchor = "1-2-3";
    const result = generateVariations(anchor, 9);
    expect(result.includes(anchor)).toBe(false);
  });

  test("every variation shares at least one punch with anchor (1-2-3)", () => {
    const anchorNums = new Set([1, 2, 3]);
    const result = generateVariations("1-2-3", 9);
    for (const v of result) {
      const nums = parsePunches(v);
      expect(nums.some((n) => anchorNums.has(n))).toBe(true);
    }
  });

  test("every variation shares at least one punch with anchor (3-4-5-6)", () => {
    const anchorNums = new Set([3, 4, 5, 6]);
    const result = generateVariations("3-4-5-6", 9);
    for (const v of result) {
      const nums = parsePunches(v);
      expect(nums.some((n) => anchorNums.has(n))).toBe(true);
    }
  });

  test("rejects invalid patterns — no three identical tokens in a row", () => {
    for (const anchor of ["1-2-3", "1-1-2", "3-4-5-6", "1-2b-3", "2-3-4"]) {
      const result = generateVariations(anchor, 9);
      for (const v of result) {
        const tokens = v.split("-").map((t) => t.toLowerCase().trim());
        for (let i = 2; i < tokens.length; i++) {
          const triple = tokens[i - 2] === tokens[i - 1] && tokens[i - 1] === tokens[i];
          expect(triple).toBe(false);
        }
      }
    }
  });

  test("rejects invalid patterns — never starts with doubled rear punch", () => {
    for (const anchor of ["2-3", "4-5-6", "6-1", "2-2-1", "1-2-3"]) {
      const result = generateVariations(anchor, 9);
      for (const v of result) {
        expect(/^2-2($|-)/.test(v)).toBe(false);
        expect(/^4-4($|-)/.test(v)).toBe(false);
        expect(/^6-6($|-)/.test(v)).toBe(false);
      }
    }
  });

  test("handles 1-punch anchor gracefully", () => {
    const result = generateVariations("1", 5);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(new Set(result).size).toBe(result.length);
    expect(result.includes("1")).toBe(false);
  });

  test("returns empty array for unparseable input", () => {
    expect(generateVariations("garbage", 3)).toEqual([]);
    expect(generateVariations("", 3)).toEqual([]);
    expect(generateVariations("7-8", 3)).toEqual([]);
    expect(generateVariations("1-x-3", 3)).toEqual([]);
  });

  test("respects count limit (returns at most count)", () => {
    expect(generateVariations("1-2-3", 0).length).toBe(0);
    expect(generateVariations("1-2-3", 2).length).toBeLessThanOrEqual(2);
    expect(generateVariations("1-2-3", 9).length).toBeLessThanOrEqual(9);
  });

  test("body suffix preserved through variations", () => {
    const result = generateVariations("1-2b-3", 9);
    for (const v of result) {
      expect(/^[1-6](b)?(-[1-6](b)?)*$/i.test(v)).toBe(true);
    }
  });
});

describe("expandForSpeech", () => {
  test("expands single-punch notation", () => {
    expect(expandForSpeech("1")).toBe("one");
    expect(expandForSpeech("3b")).toBe("three to the body");
  });

  test("expands multi-punch notation with comma-space joiner", () => {
    expect(expandForSpeech("1-2-3")).toBe("one, two, three");
    expect(expandForSpeech("1-2b-3")).toBe("one, two to the body, three");
    expect(expandForSpeech("1-1-2-3b")).toBe("one, one, two, three to the body");
    expect(expandForSpeech("4-6b")).toBe("four, six to the body");
  });

  test("returns empty string for unparseable input", () => {
    expect(expandForSpeech("")).toBe("");
    expect(expandForSpeech("garbage")).toBe("");
    expect(expandForSpeech("9-2")).toBe("");
  });

  test("case-insensitive body suffix", () => {
    expect(expandForSpeech("2B")).toBe("two to the body");
    expect(expandForSpeech("1-2B-3")).toBe("one, two to the body, three");
  });
});

describe("pickDeterministic", () => {
  test("same seed picks same item", () => {
    const arr = ["a", "b", "c"];
    expect(pickDeterministic(arr, "seed-1")).toBe(pickDeterministic(arr, "seed-1"));
  });

  test("different seeds may pick different items", () => {
    const arr = ["a", "b", "c", "d", "e"];
    const picks = new Set<string>();
    for (let i = 0; i < 50; i++) {
      picks.add(pickDeterministic(arr, `seed-${i}`));
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});
