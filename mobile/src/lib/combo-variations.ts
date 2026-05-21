export type ComboNotation = string;

type Token = { n: number; body: boolean };

const REAR_HAND = new Set([2, 4, 6]);

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseNotation(s: string): Token[] {
  if (!s) return [];
  const parts = s.split("-").map((p) => p.trim()).filter(Boolean);
  const tokens: Token[] = [];
  for (const part of parts) {
    const match = /^([1-6])(b?)$/i.exec(part);
    if (!match) return [];
    tokens.push({ n: parseInt(match[1], 10), body: match[2].toLowerCase() === "b" });
  }
  return tokens;
}

function formatNotation(tokens: Token[]): string {
  return tokens.map((t) => `${t.n}${t.body ? "b" : ""}`).join("-");
}

function isValidCombo(tokens: Token[]): boolean {
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    if (!Number.isInteger(t.n) || t.n < 1 || t.n > 6) return false;
  }
  // No 3 identical tokens in a row (compare both n and body).
  for (let i = 2; i < tokens.length; i++) {
    const a = tokens[i - 2];
    const b = tokens[i - 1];
    const c = tokens[i];
    if (a.n === b.n && b.n === c.n && a.body === b.body && b.body === c.body) {
      return false;
    }
  }
  // No 6-in-a-row alternation of the same two distinct tokens.
  for (let i = 5; i < tokens.length; i++) {
    const a = tokens[i - 5];
    const b = tokens[i - 4];
    if (a.n === b.n && a.body === b.body) continue;
    let alternates = true;
    for (let k = 0; k < 6; k++) {
      const ref = k % 2 === 0 ? a : b;
      const cur = tokens[i - 5 + k];
      if (cur.n !== ref.n || cur.body !== ref.body) {
        alternates = false;
        break;
      }
    }
    if (alternates) return false;
  }
  // Doubled rear punch at positions 0–1 has no setup — unrealistic.
  if (tokens.length >= 2) {
    const t0 = tokens[0];
    const t1 = tokens[1];
    if (REAR_HAND.has(t0.n) && t0.n === t1.n) return false;
  }
  return true;
}

function sharesPunch(variation: Token[], anchor: Token[]): boolean {
  const anchorNums = new Set(anchor.map((t) => t.n));
  return variation.some((t) => anchorNums.has(t.n));
}

type Strategy = (tokens: Token[], rng: () => number) => Token[] | null;

const dropLast: Strategy = (tokens) => {
  if (tokens.length <= 1) return null;
  return tokens.slice(0, -1);
};

const dropFirst: Strategy = (tokens) => {
  if (tokens.length <= 1) return null;
  return tokens.slice(1);
};

const bodifyLast: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.body) return null;
  return [...tokens.slice(0, -1), { n: last.n, body: true }];
};

const bodifyMiddle: Strategy = (tokens) => {
  if (tokens.length < 3) return null;
  const mid = Math.floor(tokens.length / 2);
  if (tokens[mid].body) return null;
  return tokens.map((t, i) => (i === mid ? { n: t.n, body: true } : t));
};

const prefixJab: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  if (tokens[0].n === 1 && !tokens[0].body) return null;
  return [{ n: 1, body: false }, ...tokens];
};

const appendLeadHook: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.n === 3 && !last.body) return null;
  return [...tokens, { n: 3, body: false }];
};

const appendLeadUppercut: Strategy = (tokens) => {
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  if (last.n === 5 && !last.body) return null;
  return [...tokens, { n: 5, body: false }];
};

const bodifyIndexOne: Strategy = (tokens) => {
  if (tokens.length < 2) return null;
  if (tokens[1].body) return null;
  return tokens.map((t, i) => (i === 1 ? { n: t.n, body: true } : t));
};

const swapLastToBody: Strategy = (tokens, rng) => bodifyLast(tokens, rng);

const STRATEGIES: Strategy[] = [
  dropLast,
  dropFirst,
  bodifyLast,
  bodifyMiddle,
  prefixJab,
  appendLeadHook,
  appendLeadUppercut,
  bodifyIndexOne,
  swapLastToBody,
];

export function generateVariations(anchor: ComboNotation, count: number): ComboNotation[] {
  if (count <= 0) return [];
  const anchorTokens = parseNotation(anchor);
  if (anchorTokens.length === 0) return [];

  const rng = mulberry32(hashString(anchor));
  const anchorFmt = formatNotation(anchorTokens);
  const seen = new Set<string>([anchorFmt]);
  const out: ComboNotation[] = [];

  for (const strategy of STRATEGIES) {
    const result = strategy(anchorTokens, rng);
    if (!result || result.length === 0) continue;
    if (!isValidCombo(result)) continue;
    if (!sharesPunch(result, anchorTokens)) continue;
    const fmt = formatNotation(result);
    if (seen.has(fmt)) continue;
    seen.add(fmt);
    out.push(fmt);
    if (out.length >= count) break;
  }

  return out;
}

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

export function expandForSpeech(notation: ComboNotation): string {
  const tokens = parseNotation(notation);
  if (tokens.length === 0) return "";
  return tokens
    .map((t) => (t.body ? `${NUMBER_WORDS[t.n]} to the body` : NUMBER_WORDS[t.n]))
    .join(", ");
}

export function pickDeterministic<T>(items: readonly T[], seed: string): T {
  if (items.length === 0) {
    throw new Error("pickDeterministic requires a non-empty array");
  }
  const idx = hashString(seed) % items.length;
  return items[idx];
}
