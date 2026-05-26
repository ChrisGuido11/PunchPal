# punchpal-generate-workout

Schema version: **v2** (Phase 1+2).

## Inputs (RequestBody)

- `boxingLevel: 'beginner' | 'intermediate' | 'advanced'` (required)
- `workoutType?: 'quick' | 'power' | 'endurance' | 'technique'` (default `power`)
- `workoutHistory: number` — count of prior completed workouts
- `userStats?` — totalWorkouts, totalMinutes, currentLevel, nextLevelProgress (drives tier 1-9 mapping), combosLearned, currentStreak, longestStreak, lastWorkoutDate
- `recentSessions?` — last 5 sessions with `difficultyRating` (1=too easy, 2=just right, 3=too hard); used to bias complexity
- `mode?: 'classic' | 'dynamic'` (default `classic`)
- `at_level_cap?: boolean` — `true` when user is pinned at `nextLevelProgress=100` having chosen Stay; layers extra upper-end + creative-name pressure on top of the always-on variety block
- `level_cap_too_easy_count_since_stay?: number`
- `recent_combo_signatures?: string[]` — last 10 **raw combo notations** (e.g. `"1-2"`, `"1-2b-3"`) the user has recently drilled. Despite the legacy column name, the field stores notations not hashes (post-2026-05-24 fix). Always rendered in the user prompt as an "avoid these exact notations" list whenever non-empty.
- `combos_user_struggles_with?: string[]` (Phase 4.1, 2026-05-24) — up to 8 raw notations the user has rated TOO HARD more often than well. Renders as "Avoid these exact notations. Simplify similar patterns."
- `combos_user_succeeds_with?: string[]` (Phase 4.1, 2026-05-24) — up to 8 raw notations the user has rated WELL repeatedly. Renders as "Similar shapes are appropriate."

## Output (`schema_version: 2`)

```ts
{
  workout_id: string;        // UUID server-side
  title: string;             // "TWO WORD: Rest of Name"
  level: BoxingLevel;
  tier: 1..9;
  rounds: Round[];
  schema_version: 2;
  duration: number;          // rounds.length * 3 (minutes of work time)
  workout_type: WorkoutType;
  mode: 'classic' | 'dynamic';
}

Round {
  round_number: number;      // 1-indexed
  anchor_combo: Combo;
  classic_description: string;   // 10-12s narrative (empty in Dynamic)
  classic_reminders: Reminder[]; // 2-3 / 3-5 / 4-6 by tier (empty in Dynamic)
  rest_tip?: string;
}

Combo {
  notation: string;          // canonical v5 grammar
  expanded_speech: string;   // server-canonicalized
  punch_count: number;
  has_body_shot: boolean;
  has_embedded_defense: boolean;
  has_embedded_footwork: boolean;
}

Reminder {
  speech: string;            // ≤4 words ideally
  category: 'form' | 'punch_correction' | 'tempo';
}
```

## v5 notation grammar (canonical)

- Punches: `[1-6]b?` (1=Jab, 2=Cross, 3=Lead Hook, 4=Rear Hook, 5=Lead Uppercut, 6=Rear Uppercut, `b` suffix = body)
- Defense (8 directional): `slip_left/slip_right`, `roll_left/roll_right`, `block_left/block_right`, `parry_left/parry_right`
- Footwork (6 directional): `pivot_left/pivot_right`, `step_back/step_in`, `shuffle_left/shuffle_right`
- Feint (6, intermediate+): `feint_jab/feint_cross/feint_hook/feint_uppercut/feint_high/feint_low`

§7.3 constraints (server-enforced):
- Combo must contain ≥1 punch AND end with a punch.
- No two consecutive non-punch tokens.
- ≤3 non-punch tokens total.
- ≤8 total tokens.
- Beginner tier: pure-punch only (no embedded tokens).

## Validation pipeline

For each round Claude returns:
1. Parse `notation` via the inlined Deno parser (`parseCombo`). Reject the round on any §7.3 violation or unknown token.
2. Verify punch count is within `PUNCH_COUNT_RANGE[boxingLevel]`.
3. For beginner tier, reject if any non-punch token is present.
4. Server overwrites `expanded_speech`, `punch_count`, `has_body_shot`, `has_embedded_defense`, `has_embedded_footwork` with deterministic values — never trust Claude's metadata.
5. Reminders: trim to tier's max, dedupe by case-insensitive speech, force `category` into the enum.
6. In Dynamic mode, force `classic_description=""` and `classic_reminders=[]` regardless of what Claude returned.

If fewer than 3 rounds survive validation, return 422 — the mobile client falls back to a canned workout from `workout-generator.ts`.

## User-prompt layer order

`buildUserPrompt` composes these blocks in order. Each renders only when its data is non-empty so cold-start users get a minimal prompt:

1. **Tier block** (always — derived from `userStats.currentLevel` + `nextLevelProgress`)
2. **Recent history block** — workout names + ratings from last 5 sessions
3. **Personalization block** — totals, streaks
4. **Variety block** — `recent_combo_signatures` notations to avoid (Phase 1+2 + 2026-05-24 always-on fix)
5. **Difficulty block** (Phase 4.1, 2026-05-24) — adaptive struggle/success lists from `combos_user_struggles_with` + `combos_user_succeeds_with`
6. **Cap block** — at-cap upper-tier directive when `at_level_cap: true`

Pre-2026-05-24 the variety signal was cap-only and stored FNV-1a hashes (Claude can't run hashes — wasted prompt budget). Notations are sent verbatim now. The difficulty block layers on top: variety = "don't repeat last week"; difficulty = "avoid patterns this user has historically struggled with, favor shapes they handle well."

If users still report repetition after both signals, the next lever is to widen the per-tier combo pool (especially T1-T2) rather than further prompt tuning.

## Lomachenko shuffle (advanced)

The system prompt explicitly seeds the model with the Lomachenko reference for `shuffle_left/shuffle_right` so advanced combos using shuffle tokens carry the angle-then-punch tactical intent (different from pivot or step). This shows up in `classic_description` text and the choice of when to use shuffle vs pivot.

## Deployment

```
supabase functions deploy punchpal-generate-workout --project-ref zeskhorwddxyjhhnpgsa
```

`config.toml` for this function may set `verify_jwt = false` if the gateway has rejected tokens after a project migration (see global memory: `feedback_supabase_edge_function_jwt`). Current default is gateway-validated.

## Known limitations / future work

- Claude occasionally produces 2-punch combos at intermediate tier; the validator drops them. If too many drops, tighten the prompt's CRITICAL RULE #1.
- T1-T2 combo universe is intentionally small (boxing principle: beginners drill fundamentals). Even with perfect variety injection, regenerating 3x at T1 reuses ~5 of the same combos. Mitigated by varying opening punch, body-shot placement, and workout titles. If users still report monotony post-launch, widen the pool with more 2-3-punch permutations rather than add embedded tokens at beginner tier.


<claude-mem-context>

</claude-mem-context>