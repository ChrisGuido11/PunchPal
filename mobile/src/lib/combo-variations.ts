export type ComboNotation = string;

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type DefenseMove =
  | "slip_left"
  | "slip_right"
  | "roll_left"
  | "roll_right"
  | "block_left"
  | "block_right"
  | "parry_left"
  | "parry_right";

export type FootworkMove =
  | "pivot_left"
  | "pivot_right"
  | "step_back"
  | "step_in"
  | "shuffle_left"
  | "shuffle_right";

export type FeintMove =
  | "feint_jab"
  | "feint_cross"
  | "feint_hook"
  | "feint_uppercut"
  | "feint_high"
  | "feint_low";

export type Punch = { kind: "punch"; n: 1 | 2 | 3 | 4 | 5 | 6; body: boolean };
export type Defense = { kind: "defense"; move: DefenseMove };
export type Footwork = { kind: "footwork"; move: FootworkMove };
export type Feint = { kind: "feint"; move: FeintMove };
export type Token = Punch | Defense | Footwork | Feint;

const DEFENSE_MOVES = new Set<string>([
  "slip_left",
  "slip_right",
  "roll_left",
  "roll_right",
  "block_left",
  "block_right",
  "parry_left",
  "parry_right",
]);
const FOOTWORK_MOVES = new Set<string>([
  "pivot_left",
  "pivot_right",
  "step_back",
  "step_in",
  "shuffle_left",
  "shuffle_right",
]);
const FEINT_MOVES = new Set<string>([
  "feint_jab",
  "feint_cross",
  "feint_hook",
  "feint_uppercut",
  "feint_high",
  "feint_low",
]);

const REAR_HAND = new Set([2, 4, 6]);

// Biomechanical helper. Orthodox stance assumed (lead = left side, rear =
// right side). Punches 1/3/5 are lead-hand; 2/4/6 are rear-hand.
// Used to enforce the slip/roll → punch-hand rule (slip_right loads the rear
// hip → next punch must be rear-hand; slip_left → lead-hand). Same for rolls.
function punchHand(p: Punch): "lead" | "rear" {
  return p.n % 2 === 1 ? "lead" : "rear";
}

// Map a defense/footwork/feint token to its variety family for
// `generateVariations`'s preservation check.
// - All footwork tokens collapse to "footwork" (pivot/step/shuffle swap freely).
// - All feints collapse to "feint" (feint_jab ↔ feint_cross etc.).
// - slip_right and roll_right share "defense_rear" (both load the rear hip,
//   so they swap freely without breaking the biomechanical rule); slip_left
//   and roll_left share "defense_lead". Blocks and parries stay exact-token
//   since their mechanics don't match a slip/roll swap.
function moveFamily(move: string): string {
  if (
    move.startsWith("pivot_") ||
    move.startsWith("step_") ||
    move.startsWith("shuffle_")
  ) {
    return "footwork";
  }
  if (move.startsWith("feint_")) return "feint";
  if (move === "slip_right" || move === "roll_right") return "defense_rear";
  if (move === "slip_left" || move === "roll_left") return "defense_lead";
  return move;
}

// Biomechanical rule for feints: the feinted punch type must NOT be the punch
// thrown immediately after. feint_high specifically draws the guard up so the
// follow must be a body shot; feint_low draws it down so the follow must be a
// head shot. Returns true if the pair violates the rule.
function feintConflictsWith(feint: FeintMove, p: Punch): boolean {
  if (feint === "feint_jab") return p.n === 1;
  if (feint === "feint_cross") return p.n === 2;
  if (feint === "feint_hook") return p.n === 3 || p.n === 4;
  if (feint === "feint_uppercut") return p.n === 5 || p.n === 6;
  if (feint === "feint_high") return p.body === false;
  if (feint === "feint_low") return p.body === true;
  return false;
}

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

// === parse ===

function tokenFromString(raw: string): Token | null {
  const part = raw.trim().toLowerCase();
  if (!part) return null;
  const punchMatch = /^([1-6])(b?)$/.exec(part);
  if (punchMatch) {
    return {
      kind: "punch",
      n: parseInt(punchMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6,
      body: punchMatch[2] === "b",
    };
  }
  if (DEFENSE_MOVES.has(part)) {
    return { kind: "defense", move: part as DefenseMove };
  }
  if (FOOTWORK_MOVES.has(part)) {
    return { kind: "footwork", move: part as FootworkMove };
  }
  if (FEINT_MOVES.has(part)) {
    return { kind: "feint", move: part as FeintMove };
  }
  return null;
}

// Strict parse. Throws on any grammar or §7.3 constraint violation.
export function parse(notation: ComboNotation): Token[] {
  if (typeof notation !== "string" || !notation.trim()) {
    throw new Error("empty notation");
  }
  const parts = notation
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error("empty notation");
  if (parts.length > 8) throw new Error("notation exceeds 8 tokens");

  const tokens: Token[] = [];
  for (const p of parts) {
    const tok = tokenFromString(p);
    if (!tok) throw new Error(`invalid token: ${p}`);
    tokens.push(tok);
  }

  let nonPunchCount = 0;
  let prevWasNonPunch = false;
  let hasPunch = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isPunch = t.kind === "punch";
    if (isPunch) {
      hasPunch = true;
    } else {
      nonPunchCount++;
      if (prevWasNonPunch) {
        throw new Error("two consecutive non-punch tokens");
      }
    }
    prevWasNonPunch = !isPunch;
  }
  if (!hasPunch) throw new Error("combo must contain at least one punch");
  if (tokens[tokens.length - 1].kind !== "punch") {
    throw new Error("combo must end with a punch");
  }
  if (nonPunchCount > 3) throw new Error("too many non-punch tokens (max 3)");

  return tokens;
}

function tryParse(notation: ComboNotation): Token[] | null {
  try {
    return parse(notation);
  } catch {
    return null;
  }
}

// === serialize ===

function tokenToString(t: Token): string {
  if (t.kind === "punch") return `${t.n}${t.body ? "b" : ""}`;
  return t.move;
}

export function serialize(tokens: Token[]): ComboNotation {
  return tokens.map(tokenToString).join("-");
}

// === expandForSpeech ===

function tokenToSpeech(t: Token): string {
  if (t.kind === "punch") {
    const word = NUMBER_WORDS[t.n];
    return t.body ? `${word} to the body` : word;
  }
  return t.move.replace(/_/g, " ");
}

export function expandForSpeech(notation: ComboNotation): string {
  const tokens = tryParse(notation);
  if (!tokens) return "";
  return tokens.map(tokenToSpeech).join(", ");
}

// === expandForDisplay ===

function tokenToDisplay(t: Token): string {
  if (t.kind === "punch") return `${t.n}${t.body ? "b" : ""}`;
  return t.move.replace(/_/g, " ");
}

export function expandForDisplay(notation: ComboNotation): string {
  const tokens = tryParse(notation);
  if (!tokens) return notation;
  return tokens.map(tokenToDisplay).join("-");
}

// === estimateSpeechDuration ===

export function estimateSpeechDuration(
  expandedSpeech: string,
  platform: "ios" | "android"
): number {
  if (!expandedSpeech) return 1000;
  const wordCount = expandedSpeech.split(/[\s,]+/).filter(Boolean).length;
  const msPerWord = platform === "ios" ? 400 : 435;
  const raw = wordCount * msPerWord + 300;
  return Math.max(1000, Math.min(8000, raw));
}

// === hashCombo ===

// FNV-1a 32-bit, hex, first 8 chars. Stable across runs.
export function hashCombo(notation: ComboNotation): string {
  const tokens = tryParse(notation);
  const canonical = tokens ? serialize(tokens) : notation;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 8);
}

// === combo metadata helpers ===

export function hasBodyShot(tokens: Token[]): boolean {
  return tokens.some((t) => t.kind === "punch" && t.body);
}

export function hasEmbeddedDefense(tokens: Token[]): boolean {
  return tokens.some((t) => t.kind === "defense");
}

export function hasEmbeddedFootwork(tokens: Token[]): boolean {
  return tokens.some((t) => t.kind === "footwork");
}

export function countPunches(tokens: Token[]): number {
  return tokens.filter((t) => t.kind === "punch").length;
}

// === legacy pure-punch validity gates ===
// These preserve the v4 generator's behavior for back-compat with the existing
// 17 unit tests: no triple-repeat, no 6-token alternation of two distinct
// tokens, no doubled rear-hand opening.

function isValidPurePunchPattern(tokens: Token[]): boolean {
  if (tokens.length === 0) return false;
  // Triple-repeat (only meaningful for punches; defense/footwork would be
  // blocked earlier by the consecutive-non-punch rule).
  for (let i = 2; i < tokens.length; i++) {
    const a = tokens[i - 2];
    const b = tokens[i - 1];
    const c = tokens[i];
    if (
      a.kind === "punch" &&
      b.kind === "punch" &&
      c.kind === "punch" &&
      a.n === b.n &&
      b.n === c.n &&
      a.body === b.body &&
      b.body === c.body
    ) {
      return false;
    }
  }
  // 6-in-a-row alternation of the same two distinct punches.
  for (let i = 5; i < tokens.length; i++) {
    const a = tokens[i - 5];
    const b = tokens[i - 4];
    if (a.kind !== "punch" || b.kind !== "punch") continue;
    if (a.n === b.n && a.body === b.body) continue;
    let alternates = true;
    for (let k = 0; k < 6; k++) {
      const ref = k % 2 === 0 ? a : b;
      const cur = tokens[i - 5 + k];
      if (
        cur.kind !== "punch" ||
        cur.n !== (ref as Punch).n ||
        cur.body !== (ref as Punch).body
      ) {
        alternates = false;
        break;
      }
    }
    if (alternates) return false;
  }
  // Doubled rear-hand opening (no setup before identical rear shot).
  if (tokens.length >= 2) {
    const t0 = tokens[0];
    const t1 = tokens[1];
    if (
      t0.kind === "punch" &&
      t1.kind === "punch" &&
      REAR_HAND.has(t0.n) &&
      t0.n === t1.n
    ) {
      return false;
    }
  }
  return true;
}

// === generateVariations strategies ===

type StrategyResult = Token[] | null;
type Strategy = (tokens: Token[], tier: Tier | undefined) => StrategyResult;

const punchOnly = (tokens: Token[]): Punch[] =>
  tokens.filter((t): t is Punch => t.kind === "punch");

const dropLast: Strategy = (tokens) => {
  if (tokens.length <= 1) return null;
  // Drop trailing tokens until we land back on a punch (preserves §7.3 ending).
  const out = tokens.slice(0, -1);
  while (out.length > 0 && out[out.length - 1].kind !== "punch") {
    out.pop();
  }
  if (out.length === 0) return null;
  return out;
};

const dropFirst: Strategy = (tokens) => {
  if (tokens.length <= 1) return null;
  // Drop leading tokens until the next token is a punch — combos may start
  // with a non-punch (e.g. feint), but our dropped-prefix variations should
  // start clean.
  const out = tokens.slice(1);
  while (out.length > 0 && out[0].kind !== "punch") {
    out.shift();
  }
  if (out.length === 0) return null;
  return out;
};

const bodifyLast: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.kind !== "punch") return null;
  if (last.body) return null;
  return [...tokens.slice(0, -1), { kind: "punch", n: last.n, body: true }];
};

const bodifyMiddle: Strategy = (tokens) => {
  const punches = punchOnly(tokens);
  if (punches.length < 3) return null;
  const midPunchIdx = Math.floor(punches.length / 2);
  if (punches[midPunchIdx].body) return null;
  // Find the absolute index of the middle punch in the tokens array.
  let seen = 0;
  let absIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punch") {
      if (seen === midPunchIdx) {
        absIdx = i;
        break;
      }
      seen++;
    }
  }
  if (absIdx < 0) return null;
  return tokens.map((t, i) =>
    i === absIdx ? { kind: "punch" as const, n: (t as Punch).n, body: true } : t
  );
};

const prefixJab: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  // Find first punch.
  const firstPunch = tokens.find((t) => t.kind === "punch") as Punch | undefined;
  if (!firstPunch) return null;
  if (firstPunch.n === 1 && !firstPunch.body) return null;
  return [{ kind: "punch" as const, n: 1, body: false }, ...tokens];
};

const appendLeadHook: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.kind === "punch" && last.n === 3 && !last.body) return null;
  return [...tokens, { kind: "punch" as const, n: 3, body: false }];
};

const appendLeadUppercut: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.kind === "punch" && last.n === 5 && !last.body) return null;
  return [...tokens, { kind: "punch" as const, n: 5, body: false }];
};

const bodifyIndexOne: Strategy = (tokens) => {
  const punches = punchOnly(tokens);
  if (punches.length < 2) return null;
  if (punches[1].body) return null;
  // Find absolute index of second punch.
  let seen = 0;
  let absIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punch") {
      if (seen === 1) {
        absIdx = i;
        break;
      }
      seen++;
    }
  }
  if (absIdx < 0) return null;
  return tokens.map((t, i) =>
    i === absIdx ? { kind: "punch" as const, n: (t as Punch).n, body: true } : t
  );
};

const insertSlipMid: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const punches = punchOnly(tokens);
  if (punches.length < 2) return null;
  // Already has a slip? Skip — duplicates pile up otherwise.
  if (tokens.some((t) => t.kind === "defense" && t.move.startsWith("slip_"))) {
    return null;
  }
  // Insert after the first punch.
  let absIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punch") {
      absIdx = i;
      break;
    }
  }
  if (absIdx < 0) return null;
  // The slip needs a punch on the very next index so the biomechanical rule
  // can pick its direction. If the next token is non-punch (or absent), skip
  // this strategy — the consecutive-non-punch rule would reject it anyway.
  const next = tokens[absIdx + 1];
  if (!next || next.kind !== "punch") return null;
  // Slip direction is dictated by the punch that follows. slip_right loads
  // the rear hip → must be followed by a rear-hand punch (2, 4, 6).
  // slip_left loads the lead hip → must be followed by a lead-hand punch (1, 3, 5).
  const direction = punchHand(next) === "rear" ? "slip_right" : "slip_left";
  const slip: Defense = { kind: "defense", move: direction };
  return [...tokens.slice(0, absIdx + 1), slip, ...tokens.slice(absIdx + 1)];
};

const FOOTWORK_POOL: FootworkMove[] = [
  "pivot_left",
  "pivot_right",
  "step_in",
  "step_back",
  "shuffle_left",
  "shuffle_right",
];

const insertPivotEnd: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const punches = punchOnly(tokens);
  if (punches.length < 2) return null;
  // Already has any footwork? Skip — variety here would conflict with
  // anchor preservation (which family-matches footwork in generateVariations).
  if (tokens.some((t) => t.kind === "footwork")) return null;
  // Insert footwork before the last punch.
  let lastPunchIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].kind === "punch") {
      lastPunchIdx = i;
      break;
    }
  }
  if (lastPunchIdx <= 0) return null;
  if (tokens[lastPunchIdx - 1].kind !== "punch") return null;
  // Rotate the inserted footwork direction deterministically based on the
  // anchor notation hash. Different anchors get different directions —
  // breaks the "every round inserted pivot_left" pattern users hit at launch.
  const seed = hashString(serialize(tokens));
  const move = FOOTWORK_POOL[seed % FOOTWORK_POOL.length];
  const fw: Footwork = { kind: "footwork", move };
  return [
    ...tokens.slice(0, lastPunchIdx),
    fw,
    ...tokens.slice(lastPunchIdx),
  ];
};

const insertRollMid: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 7) return null;
  const punches = punchOnly(tokens);
  if (punches.length < 3) return null;
  if (tokens.some((t) => t.kind === "defense" && t.move.startsWith("roll_"))) {
    return null;
  }
  // Insert roll between the second and third punch (or near the middle).
  let punchSeen = 0;
  let absIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punch") {
      if (punchSeen === 1) {
        absIdx = i;
        break;
      }
      punchSeen++;
    }
  }
  if (absIdx < 0) return null;
  if (absIdx + 1 >= tokens.length) return null;
  const next = tokens[absIdx + 1];
  if (next.kind !== "punch") return null;
  // Same biomechanical rule as slip: roll_right loads rear hip → next punch
  // must be rear-hand; roll_left → lead-hand.
  const direction = punchHand(next) === "rear" ? "roll_right" : "roll_left";
  const roll: Defense = { kind: "defense", move: direction };
  return [...tokens.slice(0, absIdx + 1), roll, ...tokens.slice(absIdx + 1)];
};

// Footwork variety strategies (Sprint 1 — combo mechanics fixes).
// When an anchor already has footwork, these produce variations with
// different directions / families so within-round footwork doesn't repeat.

const swapFootworkDirection: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const fwIdx = tokens.findIndex((t) => t.kind === "footwork");
  if (fwIdx < 0) return null;
  const current = (tokens[fwIdx] as Footwork).move;
  // Swap within the same family (direction flip).
  const swap: Record<FootworkMove, FootworkMove> = {
    pivot_left: "pivot_right",
    pivot_right: "pivot_left",
    step_in: "step_back",
    step_back: "step_in",
    shuffle_left: "shuffle_right",
    shuffle_right: "shuffle_left",
  };
  const swapped = swap[current];
  if (!swapped) return null;
  return tokens.map((t, i) =>
    i === fwIdx ? { kind: "footwork" as const, move: swapped } : t
  );
};

const swapFootworkFamily: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const fwIdx = tokens.findIndex((t) => t.kind === "footwork");
  if (fwIdx < 0) return null;
  const current = (tokens[fwIdx] as Footwork).move;
  // Cycle to a different family (pivot → step → shuffle → pivot).
  const familyCycle: Record<string, FootworkMove> = {
    pivot_left: "step_in",
    pivot_right: "step_back",
    step_in: "shuffle_left",
    step_back: "shuffle_right",
    shuffle_left: "pivot_left",
    shuffle_right: "pivot_right",
  };
  const next = familyCycle[current];
  if (!next) return null;
  return tokens.map((t, i) =>
    i === fwIdx ? { kind: "footwork" as const, move: next } : t
  );
};

const swapFootworkFamilyAlt: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const fwIdx = tokens.findIndex((t) => t.kind === "footwork");
  if (fwIdx < 0) return null;
  const current = (tokens[fwIdx] as Footwork).move;
  // Alternate cycle so we get a 3rd distinct family variation.
  const familyCycleAlt: Record<string, FootworkMove> = {
    pivot_left: "shuffle_right",
    pivot_right: "shuffle_left",
    step_in: "pivot_right",
    step_back: "pivot_left",
    shuffle_left: "step_back",
    shuffle_right: "step_in",
  };
  const next = familyCycleAlt[current];
  if (!next) return null;
  return tokens.map((t, i) =>
    i === fwIdx ? { kind: "footwork" as const, move: next } : t
  );
};

// Feint variety strategies — same parrot-repeat fix we applied to footwork.
// An anchor with feint_jab needs variations using feint_cross / feint_hook /
// etc. so a 3-minute Dynamic round doesn't feel like one feint on loop.

const FEINT_CYCLE: FeintMove[] = [
  "feint_jab",
  "feint_cross",
  "feint_hook",
  "feint_uppercut",
  "feint_high",
  "feint_low",
];

// Try to swap a feint to a different type, advancing through the cycle until
// we find one that doesn't violate the biomechanical rule against the punch
// that follows. `offset` lets two distinct strategies pick different swaps.
function trySwapFeint(
  tokens: Token[],
  feintIdx: number,
  offset: number
): Token[] | null {
  const current = (tokens[feintIdx] as Feint).move;
  const currentPos = FEINT_CYCLE.indexOf(current);
  if (currentPos < 0) return null;
  const next = tokens[feintIdx + 1];
  const punchAfter = next?.kind === "punch" ? (next as Punch) : null;
  for (let step = 1; step <= FEINT_CYCLE.length; step++) {
    const idx = (currentPos + offset + step) % FEINT_CYCLE.length;
    const candidate = FEINT_CYCLE[idx];
    if (candidate === current) continue;
    if (punchAfter && feintConflictsWith(candidate, punchAfter)) continue;
    return tokens.map((t, i) =>
      i === feintIdx ? { kind: "feint" as const, move: candidate } : t
    );
  }
  return null;
}

const swapFeintType: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const feintIdx = tokens.findIndex((t) => t.kind === "feint");
  if (feintIdx < 0) return null;
  return trySwapFeint(tokens, feintIdx, 0);
};

const swapFeintTypeAlt: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 4) return null;
  const feintIdx = tokens.findIndex((t) => t.kind === "feint");
  if (feintIdx < 0) return null;
  // Different starting offset so a second distinct variation comes out.
  return trySwapFeint(tokens, feintIdx, 2);
};

// Defense technique swap (tier 7+). Anchor with slip_right yields variation
// with roll_right — same hip load, same biomechanical pairing with the next
// punch, just a different defense technique. Small variety win.
const swapDefenseTechnique: Strategy = (tokens, tier) => {
  if (tier === undefined || tier < 7) return null;
  const idx = tokens.findIndex(
    (t) =>
      t.kind === "defense" &&
      (t.move.startsWith("slip_") || t.move.startsWith("roll_"))
  );
  if (idx < 0) return null;
  const current = (tokens[idx] as Defense).move;
  const swap: Record<string, DefenseMove> = {
    slip_left: "roll_left",
    slip_right: "roll_right",
    roll_left: "slip_left",
    roll_right: "slip_right",
  };
  const next = swap[current];
  if (!next) return null;
  return tokens.map((t, i) =>
    i === idx ? { kind: "defense" as const, move: next } : t
  );
};

const STRATEGIES: Strategy[] = [
  dropLast,
  dropFirst,
  bodifyLast,
  bodifyMiddle,
  prefixJab,
  appendLeadHook,
  appendLeadUppercut,
  bodifyIndexOne,
  // Footwork direction/family swaps run BEFORE insertPivotEnd so anchors that
  // already have footwork yield multiple direction variants before we'd
  // bother inserting a new one. Within a single round (where variations
  // preserve the anchor's footwork family), this is what gives the user
  // pivot_left → pivot_right → step_in → shuffle_left across the 3 minutes.
  swapFootworkDirection,
  swapFootworkFamily,
  swapFootworkFamilyAlt,
  swapFeintType,
  swapFeintTypeAlt,
  swapDefenseTechnique,
  insertSlipMid,
  insertPivotEnd,
  insertRollMid,
];

function tierBudget(tier: Tier | undefined): number {
  if (tier === undefined) return 0; // legacy mode: pure-punch only
  if (tier <= 3) return 0;
  if (tier <= 6) return 2;
  return 3;
}

function sharesPunch(candidate: Token[], anchor: Token[]): boolean {
  const anchorNums = new Set(
    anchor.filter((t): t is Punch => t.kind === "punch").map((t) => t.n)
  );
  return candidate
    .filter((t): t is Punch => t.kind === "punch")
    .some((t) => anchorNums.has(t.n));
}

export function generateVariations(
  anchor: ComboNotation,
  count: number,
  tier?: Tier
): ComboNotation[] {
  if (count <= 0) return [];
  const anchorTokens = tryParse(anchor);
  if (!anchorTokens || anchorTokens.length === 0) return [];

  const budget = tierBudget(tier);
  const anchorEmbedded = anchorTokens.filter((t) => t.kind !== "punch");

  const anchorCanonical = serialize(anchorTokens);
  const seen = new Set<string>([anchorCanonical]);
  const out: ComboNotation[] = [];

  for (const strategy of STRATEGIES) {
    const raw = strategy(anchorTokens, tier);
    if (!raw || raw.length === 0) continue;

    // Re-parse via serialize → parse so we enforce §7.3 + canonicalize.
    const serialized = serialize(raw);
    const validated = tryParse(serialized);
    if (!validated) continue;

    // Tier budget on non-punch tokens.
    const nonPunchCount = validated.filter((t) => t.kind !== "punch").length;
    if (nonPunchCount > budget) continue;

    // Pure-punch heuristic validity (back-compat with the v4 tests).
    if (!isValidPurePunchPattern(validated)) continue;

    // Variation must share at least one punch with the anchor.
    if (!sharesPunch(validated, anchorTokens)) continue;

    // When the anchor has embedded moves, preserve at least one — by family
    // for footwork (pivot_left and pivot_right count as the same family) and
    // by exact token for defenses/feints (defense direction is locked to the
    // following punch's hand per the biomechanical rule, so a direction swap
    // would break form). This loosened rule is what gives Dynamic mode its
    // within-round footwork variety: variations of a "1-2-pivot_left-3"
    // anchor can include "1-2-pivot_right-3" etc.
    if (anchorEmbedded.length > 0) {
      const variationFamilies = new Set(
        validated
          .filter((t) => t.kind !== "punch")
          .map((t) => moveFamily((t as Defense | Footwork | Feint).move))
      );
      let preserved = false;
      for (const a of anchorEmbedded) {
        const fam = moveFamily((a as Defense | Footwork | Feint).move);
        if (variationFamilies.has(fam)) {
          preserved = true;
          break;
        }
      }
      if (!preserved) continue;
    }

    const canonical = serialize(validated);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
    if (out.length >= count) break;
  }

  return out;
}

// === pickDeterministic (kept for back-compat / rest-period tip seeding) ===

function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function pickDeterministic<T>(items: readonly T[], seed: string): T {
  if (items.length === 0) {
    throw new Error("pickDeterministic requires a non-empty array");
  }
  const idx = hashString(seed) % items.length;
  return items[idx];
}
