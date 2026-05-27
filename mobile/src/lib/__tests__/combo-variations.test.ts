import { describe, expect, test } from "bun:test";
import {
  estimateSpeechDuration,
  expandForDisplay,
  expandForSpeech,
  generateVariations,
  hashCombo,
  parse,
  pickDeterministic,
  serialize,
} from "../combo-variations";

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

const countNonPunchTokens = (notation: string): number =>
  notation
    .split("-")
    .filter((p) => p.trim() && !/^[1-6]b?$/i.test(p.trim())).length;

// === legacy back-compat tests (v4) ===

describe("generateVariations (legacy pure-punch back-compat)", () => {
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

  test("body suffix preserved through variations (no tier → pure-punch only)", () => {
    const result = generateVariations("1-2b-3", 9);
    for (const v of result) {
      expect(/^[1-6](b)?(-[1-6](b)?)*$/i.test(v)).toBe(true);
    }
  });
});

describe("expandForSpeech (legacy pure-punch)", () => {
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

// === v5 grammar / parse / serialize ===

describe("parse (v5 grammar)", () => {
  test("parses pure-punch notations", () => {
    const tokens = parse("1-2-3");
    expect(tokens.length).toBe(3);
    expect(tokens.every((t) => t.kind === "punch")).toBe(true);
  });

  test("parses body suffix (lower and upper case)", () => {
    expect(parse("2b")[0]).toEqual({ kind: "punch", n: 2, body: true });
    expect(parse("2B")[0]).toEqual({ kind: "punch", n: 2, body: true });
  });

  test("parses embedded defense token", () => {
    const tokens = parse("1-2-slip_right-3");
    expect(tokens[2]).toEqual({ kind: "defense", move: "slip_right" });
  });

  test("parses embedded footwork token", () => {
    const tokens = parse("1-pivot_left-2");
    expect(tokens[1]).toEqual({ kind: "footwork", move: "pivot_left" });
  });

  test("parses feint token", () => {
    const tokens = parse("feint_jab-2-3");
    expect(tokens[0]).toEqual({ kind: "feint", move: "feint_jab" });
  });

  test("parses all 8 directional defense moves", () => {
    for (const m of [
      "slip_left",
      "slip_right",
      "roll_left",
      "roll_right",
      "block_left",
      "block_right",
      "parry_left",
      "parry_right",
    ]) {
      expect(() => parse(`1-${m}-2`)).not.toThrow();
    }
  });

  test("parses all 6 footwork moves", () => {
    for (const m of [
      "pivot_left",
      "pivot_right",
      "step_back",
      "step_in",
      "shuffle_left",
      "shuffle_right",
    ]) {
      expect(() => parse(`1-${m}-2`)).not.toThrow();
    }
  });

  test("parses all 6 feint moves", () => {
    for (const m of [
      "feint_jab",
      "feint_cross",
      "feint_hook",
      "feint_uppercut",
      "feint_high",
      "feint_low",
    ]) {
      expect(() => parse(`${m}-2`)).not.toThrow();
    }
  });

  test("rejects empty notation", () => {
    expect(() => parse("")).toThrow();
    expect(() => parse("   ")).toThrow();
  });

  test("rejects invalid token", () => {
    expect(() => parse("7-2")).toThrow();
    expect(() => parse("garbage")).toThrow();
    expect(() => parse("slip_diagonal")).toThrow();
  });

  test("rejects combo with no punches (§7.3)", () => {
    expect(() => parse("slip_left")).toThrow();
  });

  test("rejects combo ending in non-punch (§7.3)", () => {
    expect(() => parse("1-2-slip_right")).toThrow();
    expect(() => parse("1-pivot_left")).toThrow();
  });

  test("rejects two consecutive non-punches (§7.3)", () => {
    expect(() => parse("1-slip_left-pivot_right-2")).toThrow();
    expect(() => parse("feint_jab-pivot_left-2")).toThrow();
  });

  test("rejects more than 3 non-punch tokens (§7.3)", () => {
    expect(() =>
      parse("1-slip_left-2-pivot_right-3-roll_left-4-feint_jab-5")
    ).toThrow();
  });

  test("rejects more than 8 total tokens (§7.3)", () => {
    expect(() => parse("1-2-3-4-1-2-3-4-1")).toThrow();
  });

  test("accepts valid intermediate combo with single embedded move", () => {
    expect(() => parse("1-2-slip_right-3")).not.toThrow();
  });

  test("accepts valid advanced combo with multiple embedded moves", () => {
    expect(() =>
      parse("1-slip_left-2-pivot_right-3b-roll_left-4")
    ).not.toThrow();
  });
});

describe("serialize", () => {
  test("round-trips with parse", () => {
    for (const n of [
      "1",
      "1-2",
      "1-2-3",
      "1-2b-3",
      "1-2-slip_right-3",
      "feint_jab-2-3",
      "1-slip_left-2-pivot_right-3b-4",
    ]) {
      expect(serialize(parse(n))).toBe(n);
    }
  });

  test("canonicalizes case (uppercase b → lower)", () => {
    expect(serialize(parse("1-2B-3"))).toBe("1-2b-3");
  });
});

// === expandForSpeech (v5) ===

describe("expandForSpeech (v5 embedded tokens)", () => {
  test("expands defense tokens with space", () => {
    expect(expandForSpeech("1-2-slip_right-3")).toBe("one, two, slip right, three");
    expect(expandForSpeech("1-roll_left-2")).toBe("one, roll left, two");
  });

  test("expands footwork tokens with space", () => {
    expect(expandForSpeech("1-pivot_left-2")).toBe("one, pivot left, two");
    expect(expandForSpeech("1-step_back-2")).toBe("one, step back, two");
  });

  test("expands feint tokens with space", () => {
    expect(expandForSpeech("feint_jab-2-3")).toBe("feint jab, two, three");
    expect(expandForSpeech("1-feint_low-2")).toBe("one, feint low, two");
  });

  test("expands combined embedded combo", () => {
    expect(expandForSpeech("1-2-roll_left-3b-pivot_right-4")).toBe(
      "one, two, roll left, three to the body, pivot right, four"
    );
  });

  test("returns empty for invalid grammar", () => {
    expect(expandForSpeech("1-slip_left-pivot_right-2")).toBe(""); // consecutive non-punch
    expect(expandForSpeech("slip_left")).toBe(""); // no punch
  });
});

// === expandForDisplay ===

describe("expandForDisplay", () => {
  test("pure-punch combo passes through unchanged", () => {
    expect(expandForDisplay("1-2-3")).toBe("1-2-3");
    expect(expandForDisplay("1-1-2")).toBe("1-1-2");
  });

  test("body shot punches keep the b suffix", () => {
    expect(expandForDisplay("1-2b-3")).toBe("1-2b-3");
    expect(expandForDisplay("3b")).toBe("3b");
  });

  test("defense tokens drop the underscore for a space", () => {
    expect(expandForDisplay("1-slip_right-3")).toBe("1-slip right-3");
    expect(expandForDisplay("1-roll_left-2")).toBe("1-roll left-2");
    expect(expandForDisplay("1-block_left-2")).toBe("1-block left-2");
    expect(expandForDisplay("1-parry_right-2")).toBe("1-parry right-2");
  });

  test("footwork and feint tokens humanize", () => {
    expect(expandForDisplay("1-pivot_left-2")).toBe("1-pivot left-2");
    expect(expandForDisplay("1-step_back-2")).toBe("1-step back-2");
    expect(expandForDisplay("1-shuffle_right-2")).toBe("1-shuffle right-2");
    expect(expandForDisplay("feint_jab-2-3")).toBe("feint jab-2-3");
  });

  test("complex combo with multiple embedded tokens", () => {
    expect(expandForDisplay("1-2-roll_left-3b-pivot_right-4")).toBe(
      "1-2-roll left-3b-pivot right-4"
    );
  });

  test("returns raw notation as fallback when parse fails", () => {
    expect(expandForDisplay("garbage")).toBe("garbage");
    expect(expandForDisplay("9-2")).toBe("9-2");
    expect(expandForDisplay("slip_left")).toBe("slip_left"); // no punch — invalid grammar
  });
});

// === estimateSpeechDuration ===

describe("estimateSpeechDuration", () => {
  test("returns at least 1000ms even for tiny speech", () => {
    expect(estimateSpeechDuration("one", "ios")).toBeGreaterThanOrEqual(1000);
    expect(estimateSpeechDuration("", "ios")).toBe(1000);
  });

  test("clamps to 8000ms for very long speech", () => {
    const long = Array.from({ length: 200 }, () => "word").join(", ");
    expect(estimateSpeechDuration(long, "ios")).toBeLessThanOrEqual(8000);
  });

  test("android takes longer per word than ios", () => {
    const speech = "one, two, three, four, five, six";
    const ios = estimateSpeechDuration(speech, "ios");
    const android = estimateSpeechDuration(speech, "android");
    expect(android).toBeGreaterThanOrEqual(ios);
  });

  test("scales with word count", () => {
    const short = estimateSpeechDuration("one, two", "ios");
    const long = estimateSpeechDuration(
      "one, two, three, four, five, six",
      "ios"
    );
    expect(long).toBeGreaterThan(short);
  });

  test("returns reasonable values for typical combos", () => {
    // "one, two, slip right, three" — 5 words → 5*400 + 300 = 2300ms on ios
    const ms = estimateSpeechDuration("one, two, slip right, three", "ios");
    expect(ms).toBeGreaterThan(1500);
    expect(ms).toBeLessThan(4000);
  });
});

// === hashCombo ===

describe("hashCombo", () => {
  test("returns 8-char hex string", () => {
    const h = hashCombo("1-2-3");
    expect(h.length).toBe(8);
    expect(/^[0-9a-f]{8}$/.test(h)).toBe(true);
  });

  test("stable across equivalent notations (case-canonical)", () => {
    expect(hashCombo("1-2B-3")).toBe(hashCombo("1-2b-3"));
  });

  test("different notations produce different hashes", () => {
    const hashes = new Set([
      hashCombo("1-2-3"),
      hashCombo("1-2-4"),
      hashCombo("1-2-slip_right-3"),
      hashCombo("feint_jab-2-3"),
    ]);
    expect(hashes.size).toBe(4);
  });

  test("falls back to raw string for unparseable input", () => {
    expect(hashCombo("garbage").length).toBe(8);
  });
});

// === tier-aware variations ===

describe("generateVariations (tier)", () => {
  test("tier 1-3: variations contain ONLY punches", () => {
    for (const tier of [1, 2, 3] as const) {
      const result = generateVariations("1-2-3", 9, tier);
      for (const v of result) {
        expect(countNonPunchTokens(v)).toBe(0);
      }
    }
  });

  test("tier 4-6: variations have at most 2 non-punch tokens", () => {
    for (const tier of [4, 5, 6] as const) {
      const result = generateVariations("1-2-3", 9, tier);
      for (const v of result) {
        expect(countNonPunchTokens(v)).toBeLessThanOrEqual(2);
      }
    }
  });

  test("tier 7-9: variations have at most 3 non-punch tokens", () => {
    for (const tier of [7, 8, 9] as const) {
      const result = generateVariations("1-2-3", 9, tier);
      for (const v of result) {
        expect(countNonPunchTokens(v)).toBeLessThanOrEqual(3);
      }
    }
  });

  test("tier 5: at least one variation contains an embedded move", () => {
    const result = generateVariations("1-2-3", 9, 5);
    const anyEmbedded = result.some((v) => countNonPunchTokens(v) > 0);
    expect(anyEmbedded).toBe(true);
  });

  test("preserves at least one embedded move from anchor (intermediate)", () => {
    const result = generateVariations("1-2-slip_right-3", 9, 5);
    for (const v of result) {
      // Family-based preservation: any slip/roll variant counts (slip_right,
      // slip_left, roll_right, roll_left all share the defense_slip_roll
      // family in moveFamily). The biomechanical validator ensures
      // direction-flipped variants pair with the correct punch hand.
      const hasSlipOrRoll =
        v.includes("slip_") || v.includes("roll_");
      expect(hasSlipOrRoll).toBe(true);
    }
  });

  test("preserves at least one embedded move from anchor (advanced multi-move)", () => {
    const result = generateVariations("1-slip_left-2-pivot_right-3", 9, 8);
    for (const v of result) {
      // At least ONE of the anchor's embedded moves survives.
      const preserved =
        v.includes("slip_left") || v.includes("pivot_right");
      expect(preserved).toBe(true);
    }
  });

  test("variations are valid v5 notation (round-trip parse)", () => {
    const result = generateVariations("1-2-slip_right-3", 9, 5);
    for (const v of result) {
      expect(() => parse(v)).not.toThrow();
    }
  });

  test("deterministic across calls with tier", () => {
    const a = generateVariations("1-2-slip_right-3", 5, 5);
    const b = generateVariations("1-2-slip_right-3", 5, 5);
    expect(a).toEqual(b);
  });

  test("returns empty for anchor that fails v5 grammar", () => {
    // Anchor "slip_left" has no punches — invalid.
    expect(generateVariations("slip_left", 5, 5)).toEqual([]);
  });
});

// === combo mechanics edge cases (Sprint 2026-05-27) ===

const tokensOf = (notation: string) =>
  notation.split("-").map((t) => t.trim().toLowerCase()).filter(Boolean);

const punchAfter = (tokens: string[], moveToken: string): string | null => {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === moveToken) {
      const next = tokens[i + 1];
      if (/^[1-6]b?$/.test(next)) return next;
    }
  }
  return null;
};

const handOf = (punch: string): "lead" | "rear" => {
  const n = parseInt(punch[0], 10);
  return n % 2 === 1 ? "lead" : "rear";
};

describe("biomechanical rule — slip direction matches next punch hand", () => {
  test("slip_right is followed by a rear-hand punch in every variation", () => {
    // Tier 5 anchor that ends with a rear-hand punch — insertSlipMid will fire
    // and must pick slip_right (since punch after slip is rear-hand).
    const variations = generateVariations("1-2", 8, 5);
    for (const v of variations) {
      const toks = tokensOf(v);
      const next = punchAfter(toks, "slip_right");
      if (next !== null) {
        expect(handOf(next)).toBe("rear");
      }
    }
  });

  test("slip_left is followed by a lead-hand punch in every variation", () => {
    // Anchor "2-1" — first punch is rear (2), next is lead (1). insertSlipMid
    // would insert slip after the first punch, before punch 1 (lead) → slip_left.
    const variations = generateVariations("2-1", 8, 5);
    for (const v of variations) {
      const toks = tokensOf(v);
      const next = punchAfter(toks, "slip_left");
      if (next !== null) {
        expect(handOf(next)).toBe("lead");
      }
    }
  });
});

describe("biomechanical rule — roll direction matches next punch hand", () => {
  test("roll_right is followed by a rear-hand punch in advanced variations", () => {
    const variations = generateVariations("1-2-3", 12, 8);
    for (const v of variations) {
      const toks = tokensOf(v);
      const next = punchAfter(toks, "roll_right");
      if (next !== null) {
        expect(handOf(next)).toBe("rear");
      }
    }
  });

  test("roll_left is followed by a lead-hand punch in advanced variations", () => {
    const variations = generateVariations("2-3-2", 12, 8);
    for (const v of variations) {
      const toks = tokensOf(v);
      const next = punchAfter(toks, "roll_left");
      if (next !== null) {
        expect(handOf(next)).toBe("lead");
      }
    }
  });
});

describe("footwork variety — within-round rotation", () => {
  test("variations of an anchor with pivot_left yield at least 2 distinct pivot directions", () => {
    // With the loosened preservation rule + swap strategies, variations of
    // "1-2-pivot_left-3" should produce some "1-2-pivot_right-3" too.
    const variations = generateVariations("1-2-pivot_left-3", 10, 5);
    const directions = new Set<string>();
    for (const v of variations) {
      const toks = tokensOf(v);
      for (const t of toks) {
        if (t === "pivot_left" || t === "pivot_right") directions.add(t);
      }
    }
    expect(directions.size).toBeGreaterThanOrEqual(2);
  });

  test("variations of an anchor with pivot also reach step or shuffle family", () => {
    // swapFootworkFamily / swapFootworkFamilyAlt rotate the family so we
    // should see step_in/back or shuffle_left/right alongside pivot variants.
    const variations = generateVariations("1-2-pivot_left-3", 12, 5);
    const families = new Set<string>();
    for (const v of variations) {
      const toks = tokensOf(v);
      for (const t of toks) {
        if (t.startsWith("pivot_")) families.add("pivot");
        if (t.startsWith("step_")) families.add("step");
        if (t.startsWith("shuffle_")) families.add("shuffle");
      }
    }
    expect(families.size).toBeGreaterThanOrEqual(2);
  });

  test("variations of an anchor with feint_jab yield at least 3 distinct feint types", () => {
    // The biomechanically-correct anchor "feint_jab-2-3" (jab fake, cross
    // exploits raised guard, lead hook follow-up). Variations should rotate
    // through feint_cross / feint_hook / feint_uppercut / feint_high /
    // feint_low — the parrot-repeat fix from the user's bug report.
    const variations = generateVariations("feint_jab-2-3", 12, 5);
    const feints = new Set<string>();
    for (const v of variations) {
      for (const t of tokensOf(v)) {
        if (t.startsWith("feint_")) feints.add(t);
      }
    }
    expect(feints.size).toBeGreaterThanOrEqual(3);
  });

  test("no variation pairs a feint with its same-type punch (biomechanical rule)", () => {
    const variations = generateVariations("feint_jab-2-3", 12, 5);
    const conflicts: Array<{ feint: string; punch: string; v: string }> = [];
    for (const v of variations) {
      const toks = tokensOf(v);
      for (let i = 0; i < toks.length - 1; i++) {
        const t = toks[i];
        const n = toks[i + 1];
        if (!t.startsWith("feint_")) continue;
        if (!/^[1-6]b?$/.test(n)) continue;
        const num = parseInt(n[0], 10);
        const body = n.endsWith("b");
        if (t === "feint_jab" && num === 1)
          conflicts.push({ feint: t, punch: n, v });
        if (t === "feint_cross" && num === 2)
          conflicts.push({ feint: t, punch: n, v });
        if (t === "feint_hook" && (num === 3 || num === 4))
          conflicts.push({ feint: t, punch: n, v });
        if (t === "feint_uppercut" && (num === 5 || num === 6))
          conflicts.push({ feint: t, punch: n, v });
        if (t === "feint_high" && !body)
          conflicts.push({ feint: t, punch: n, v });
        if (t === "feint_low" && body)
          conflicts.push({ feint: t, punch: n, v });
      }
    }
    expect(conflicts).toEqual([]);
  });

  test("advanced anchor with slip_right also produces a roll_right variation", () => {
    // swapDefenseTechnique fires at tier 7+. slip_right (rear-hip load) →
    // roll_right (same hip load, different technique). Followed-punch stays
    // the same so the biomechanical rule is preserved.
    const variations = generateVariations("1-2-slip_right-4", 12, 8);
    const hasRollRight = variations.some((v) =>
      tokensOf(v).includes("roll_right")
    );
    expect(hasRollRight).toBe(true);
  });

  test("insertPivotEnd rotates the inserted footwork direction across different anchors", () => {
    // Two distinct anchors with no embedded footwork — the inserted footwork
    // token should not be the same direction for both (hash-based rotation).
    const a = generateVariations("1-2", 12, 5);
    const b = generateVariations("1-2-3-4", 12, 5);
    const collectFootwork = (vs: string[]) => {
      const fw = new Set<string>();
      for (const v of vs) {
        for (const t of tokensOf(v)) {
          if (
            t.startsWith("pivot_") ||
            t.startsWith("step_") ||
            t.startsWith("shuffle_")
          ) {
            fw.add(t);
          }
        }
      }
      return fw;
    };
    const fwA = collectFootwork(a);
    const fwB = collectFootwork(b);
    // At least one should differ — full equality would mean every anchor
    // produces the same footwork direction (the bug we're fixing).
    expect(fwA.size > 0 || fwB.size > 0).toBe(true);
    if (fwA.size === 1 && fwB.size === 1) {
      const onlyA = [...fwA][0];
      const onlyB = [...fwB][0];
      expect(onlyA).not.toBe(onlyB);
    }
  });
});
