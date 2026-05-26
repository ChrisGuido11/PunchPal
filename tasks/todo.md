# Phase 1+2 — Dynamic + Embedded Tokens + Progression System

**Spec:** `Shadow boxing teardown v5` (sections §5 mode behavior, §6 progression, §7 notation) + `mobile/Phase 1+2 build prompt`.

**Goal:** Ship Classic+Dynamic modes with embedded defense/footwork/feints scaled by tier, rating-driven progression, celebration modal at level-cap, demotion safety net, and cap-state variety.

**Prior state (committed in `a030f39`):** Phase 1 v4 already landed: `combo-variations.ts` (pure-punch only, 9 strategies, 17 tests), `userStore.workoutMode`, `WorkoutModeToggle`, TimerScreen Dynamic branch (fixed 45/28/18s cadence + 2 fillers). v5 supersedes most of it — the notation library extends, the Dynamic scheduler rewrites, the EF rewrites, and the progression system is brand new.

**Hand-coded rule reminders:** Windows-only (no Xcode/Mac flows). NativeWind v4 className only. Zustand+AsyncStorage. `TABLES.*` for table names. No emojis. Don't bump `version`/`versionCode`. **Ignore `mobile/CLAUDE.md` (stale Vibecode template)** — repo `CLAUDE.md` files + global memory facts are authoritative.

---

## Stage 0 — Workout schema redesign (foundation)

The EF currently returns `{ name, duration, rounds, combos[{name,description,notation}] }`. v5 wants `{ schema_version: 2, rounds[{ anchor_combo: Combo, classic_description, classic_reminders[], rest_tip? }] }`. This breaks `WorkoutPlan` shape, `currentWorkout` persisted state, TimerScreen's `combos[currentComboIndex]` reads, ProfileScreen history rendering, achievements rounds-count, and the EF client wrapper.

- [ ] Update `mobile/src/types/workout.ts`: add `Combo`, `Reminder`, `Round` types matching v5 §7.5. Keep `WorkoutPlan` but replace `combos: PunchCombo[]` with `rounds: Round[]` and add `tier: 1-9`, `schemaVersion: 2`, `level: BoxingLevel` (rename `difficulty`). Keep legacy `PunchCombo` type alias for one release to ease migration.
- [ ] Update `mobile/src/api/workout-generator.ts` (read first, then map EF JSON → `WorkoutPlan`). Ensure mapped object includes generated `id`, `generatedAt: new Date()`.
- [ ] Bump userStore persist `version` to 2; in `migrate(state, fromVersion)`, when `fromVersion < 2`, null out `state.currentWorkout` (legacy schema; forces regeneration on next HomeScreen load). Keep the v4→v1 mode-migration logic.
- [ ] All consumers of `currentWorkout.combos[]`: TimerScreen, HomeScreen, ProfileScreen, WorkoutCard. Rewrite to read `rounds[]`. ProfileScreen "Workout History" reads `workoutHistory[]` (a different shape — `WorkoutHistory` — unaffected).

---

## Deliverable 1 — Database schema migration (4 new columns)

- [ ] Create `mobile/supabase/migrations/004_progression_columns.sql` (historical record only; `supabase db push` is blocked by shared-project sibling migrations):

  ```sql
  ALTER TABLE IF EXISTS punchpal_user_stats
    ADD COLUMN IF NOT EXISTS level_cap_staying_since timestamptz NULL,
    ADD COLUMN IF NOT EXISTS level_cap_too_easy_count_since_stay int NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recent_combo_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS demotion_window jsonb NOT NULL DEFAULT '[]'::jsonb;
  ```

- [ ] Create `mobile/supabase/functions/punchpal-migration-004/index.ts` (temp; delete after applying). Uses `postgres` from `https://deno.land/x/postgresjs/mod.js`, opens `Deno.env.get("SUPABASE_DB_URL")!`, runs the four `ADD COLUMN IF NOT EXISTS` idempotently, returns `{ ok: true, columns: [...] }`. CORS headers consistent with other EFs.
- [ ] Deploy via `supabase functions deploy punchpal-migration-004 --project-ref zeskhorwddxyjhhnpgsa`. Invoke once via curl with anon key. Verify columns exist (query `information_schema.columns where table_name='punchpal_user_stats'`). Then delete the function from local + from Supabase dashboard.
- [ ] Update `mobile/src/api/database-service.ts`:
  - Extend `UserStats` interface with `levelCapStayingSince: string | null`, `levelCapTooEasyCountSinceStay: number`, `recentComboSignatures: string[]`, `demotionWindow: RatingOutcome[]`.
  - Update `getUserStats` + `upsertUserStats` to read/write the four new snake-case columns.

---

## Deliverable 2 — Notation library v2 (extend `combo-variations.ts`)

The existing file only handles `[1-6](b?)` tokens. v5 §7 grammar is much richer.

- [ ] **Extend the type system.** New `Token` union with `punch | defense | footwork | feint` kinds. 8 directional defense tokens (`slip_left/slip_right/roll_left/roll_right/block_left/block_right/parry_left/parry_right`), 6 footwork tokens (`pivot_left/pivot_right/step_back/step_in/shuffle_left/shuffle_right`), 6 feint tokens (`feint_jab/feint_cross/feint_hook/feint_uppercut/feint_high/feint_low`).
- [ ] **`parse(notation)` rewrite.** Per v5 §7.1 grammar. Enforce §7.3 constraints: must contain a punch AND must end with a punch token; no two consecutive non-punch tokens; ≤3 non-punch tokens; ≤8 total tokens. Throws descriptive errors on invalid input. Handles legacy v1 notations (pure-punch) without error.
- [ ] **`serialize(tokens): notation`.** Inverse of parse, with consistent canonical formatting.
- [ ] **`expandForSpeech(notation): string`.** Per v5 §5.5. Multi-word tokens use underscores in notation but spaces in speech (`slip_right` → `"slip right"`, `feint_jab` → `"feint jab"`). Punches `1-6` → number words. `b` suffix → `" to the body"`. Tokens joined with `", "`.
- [ ] **`estimateSpeechDuration(expandedSpeech, platform: 'ios'|'android'): number`.** Returns ms. Count words (commas are boundaries), multiply by 400ms iOS / 435ms Android, add 300ms startup buffer, clamp to `[1000, 8000]`.
- [ ] **`generateVariations(anchor, count, tier)` rewrite.** Deterministic seeded by anchor. Variations preserve at least one embedded move from the anchor when present (was: "share a punch"). Tier respect: T1-3 punches only; T4-6 ≤2 non-punch tokens per variation; T7-9 ≤3. Returns up to `count` unique variations (never duplicates the anchor; never duplicates within the return).
- [ ] **`hashCombo(notation): string`.** First 8 chars of a stable hash (FNV-1a hex or SHA-1 first chars) over canonicalized notation. Used for `recent_combo_signatures`.
- [ ] Keep `pickDeterministic` export (currently used for fillers — Dynamic mode in v5 drops fillers but Classic-mode rest-period tips may want it, so retain).
- [ ] **Rewrite `mobile/src/lib/__tests__/combo-variations.test.ts`.** Keep existing pure-punch test cases; add:
  - `parse` accepts all v5 grammar branches; rejects empty, all §7.3 violations (two consecutive non-punches, ending with non-punch, >3 non-punches, >8 total).
  - `parse` round-trips with `serialize`.
  - `expandForSpeech` for `1-2-slip_right-3` → `"one, two, slip right, three"`; `feint_jab-2-3` → `"feint jab, two, three"`; `1-2-roll-3b-pivot_right-4` → `"one, two, roll, three to the body, pivot right, four"`.
  - `estimateSpeechDuration` returns ms in [1000, 8000] for sample combos; sane scaling with token count.
  - `generateVariations(t=2, ...)` returns variations with zero non-punch tokens.
  - `generateVariations(t=5, ...)` returns variations with ≤2 non-punch tokens; preserves an embedded `slip_*` from anchor when present.
  - `generateVariations(t=8, ...)` allows up to 3 non-punch tokens.
  - `hashCombo` is stable across equivalent notations and differs across distinct ones.
  - All 17 existing tests still pass against the extended API (back-compat).

---

## Deliverable 3 — Progression points logic (`mobile/src/lib/progression.ts`)

Pure module, no IO. Tested via `bun test`.

- [ ] Create file with public API per Phase 1+2 prompt: `RatingOutcome` union (`'too_easy'|'just_right'|'too_hard'|'skipped'|'early_exit'`), `pointsForOutcome`, `ProgressionInput`/`ProgressionResult`, `computeProgression`.
- [ ] **Point values:** too_easy +15, just_right +10, too_hard +5, skipped +8, early_exit +2.
- [ ] **Logic:**
  - newProgress = currentProgress + points.
  - If `levelCapStayingSince !== null` AND outcome === 'too_easy': increment `newLevelCapTooEasyCount` (cap at 3).
  - newDemotionWindow = `[...currentWindow, outcome].slice(-5)`.
  - shouldShowCelebration: `newProgress >= 100 && currentLevel !== 'advanced'` AND NOT (`levelCapStayingSince !== null && newLevelCapTooEasyCount < 3`).
  - newLevelIfAdvancing: 'intermediate' (from beginner) or 'advanced' (from intermediate). null at advanced or if not celebrating.
  - shouldShowDemotionHint: `currentLevel !== 'beginner'` AND `newDemotionWindow.filter(o => o === 'too_hard').length >= 3`.
  - Advanced + progress >= 100: cap at 100. No celebration ever at advanced.
- [ ] Create `mobile/src/lib/__tests__/progression.test.ts`:
  - Point values match the table.
  - Brand-new beginner rating "Just Right" → progress 10, no celebration, no hint.
  - Beginner at progress=90 + "Just Right" → progress 100, celebration true, newLevel='intermediate'.
  - Beginner at progress=100 with `levelCapStayingSince` set + "Too Easy" once → count 1, no celebration.
  - Same scenario × 3 → count 3, celebration true.
  - Advanced at 90 + "Just Right" → 100 cap, no celebration.
  - Demotion: intermediate user with window `['too_hard','too_hard','too_easy','too_hard','just_right']` + 'too_hard' → window slides; hint TRUE (3 of last 5).
  - Demotion: intermediate user with only 2 too_hard in last 5 → hint FALSE.
  - Beginner can never trigger demotion hint regardless of window.
  - Early-exit adds only +2, regardless of rating choice.

---

## Deliverable 4 — Edge Function rewrite (`punchpal-generate-workout`)

Currently returns schema v1 (`combos[]`). Rewrite to return v2 (`rounds[]`). Big prompt update.

- [ ] **New `RequestBody` shape.** Add `mode: 'classic'|'dynamic'`, `at_level_cap: boolean`, `level_cap_too_easy_count_since_stay: number`, `recent_combo_signatures: string[]`. Keep existing `boxingLevel`, `workoutType`, `workoutHistory`, `userStats`, `recentSessions` fields.
- [ ] **New output schema.** Per v5 §7.5: `{ workout_id, title, level, tier, rounds[], schema_version: 2 }`. Each `Round` has `round_number, anchor_combo: Combo, classic_description, classic_reminders: Reminder[], rest_tip? }`. `Combo` has `notation, expanded_speech, punch_count, has_body_shot, has_embedded_defense, has_embedded_footwork`. Wire up `output_config.format.type: 'json_schema'` with the new schema.
- [ ] **Prompt updates (extends current `buildSystemPrompt`):**
  - Add the extended notation grammar (defense 8 directional, footwork 6, feint 6) with the exact token names.
  - "Beginner tier (T1-T3) combos contain ONLY punches with optional `b` suffix."
  - "Intermediate (T4-T6) and Advanced (T7-T9) combos may use defense, footwork, and feint tokens."
  - "Combos must END with a punch token. Non-punch tokens may NOT appear consecutively. Total tokens ≤ 8. Non-punch tokens ≤ 3."
  - Token-to-speech expansion examples (Claude pre-expands into `expanded_speech`).
  - For Classic: generate `classic_description` (10-12s teaching narrative) and `classic_reminders` (counts 2-3 / 3-5 / 4-6 by tier; ≤4 words each; categories `form|punch_correction|tempo`; never repeat the same cue twice in a round; mix categories).
  - For Dynamic: anchor combo only; `classic_description = ""`, `classic_reminders = []`.
  - When `at_level_cap === true`: append the cap-state directive ("Prioritize variety and surprise. Avoid the combo signatures in `recent_combo_signatures`. Use creative workout names. Pull from edge-case combinations within the current level's vocabulary.").
  - Lomachenko instruction for advanced shuffles: "When using `shuffle_left` or `shuffle_right` in advanced combos, draw inspiration from Lomachenko's signature lateral movement — shuffle to an angle, then punch from the new position."
- [ ] **Server-side validation:** Implement a Deno copy of `parse` and `expandForSpeech` in the EF (small enough to inline; do NOT pull in the mobile lib). For each combo:
  - Re-parse `notation`; reject if invalid per §7.3.
  - Reject beginner-tier combos containing non-punch tokens.
  - Overwrite Claude's `expanded_speech` with the deterministic expansion if they differ.
  - Recompute `punch_count`, `has_body_shot`, `has_embedded_defense`, `has_embedded_footwork` (don't trust Claude).
  - If fewer than 3 rounds survive validation, return 422 (client falls back to canned workout).
- [ ] **Preserve current contract:** one anchor combo per round, `rounds.length === requestedRoundCount`. If Claude returns more/fewer, trim/expand similarly to current code.
- [ ] **Update `mobile/supabase/functions/punchpal-generate-workout/CLAUDE.md`** with: the v5 schema contract, validation rules, and prompt rationale (Lomachenko / cap-state / tier embedding bounds). Currently empty — populate with the post-v5 guidance.

---

## Deliverable 5 — Zustand store updates

Existing `userStore.ts` has `workoutMode` + migration logic. Need to add progression state and bump persist version (to invalidate stale `currentWorkout` from schema v1).

- [ ] Add fields:
  - `nextLevelProgress: number` (0-100, default 0).
  - `levelCapStayingSince: string | null` (ISO timestamp; null default).
  - `levelCapTooEasyCountSinceStay: number` (default 0).
  - `demotionWindow: RatingOutcome[]` (default `[]`, ring buffer max 5).
- [ ] Add setters: `setNextLevelProgress`, `setLevelCapState({ stayingSince, count })`, `setDemotionWindow`, plus a composite `applyProgressionResult(result)` to write atomically from TimerScreen.
- [ ] Bump persist `version: 1 → 2`. In `migrate(state, fromVersion)`:
  - Preserve the existing `fromVersion < 1` workoutMode migration logic.
  - When `fromVersion < 2`: null out `state.currentWorkout` (schema v1 → v2 invalidation). Ensure new progression fields initialize to their defaults.
- [ ] On app launch (Splash or App.tsx): after `initializeUser` resolves, fetch `getUserStats` and hydrate the new fields from DB. DB wins if present; fall back to existing store value. (Pattern: `useEffect` that runs once when `userId` becomes non-null.)

---

## Deliverable 6 — TimerScreen rewrite

The single largest deliverable. Current TimerScreen (911 lines) already has Classic+Dynamic branching from Phase 1 (v4), but:
- Dynamic uses fixed cadence (45/28/18s) + fillers — v5 wants gap-based hybrid + no fillers.
- Workout shape is `combos[i]` flat with `{name, description, notation}` — v5 wants `rounds[i]` with structured fields.
- Rating modal returns `1|2|3` mapped to old logic — v5 needs to map to `RatingOutcome` and run `computeProgression`.
- `formatNotationForSpeech` local helper duplicates `expandForSpeech` — delete and use library.

**Sub-plan:**

- [ ] **Read `currentWorkout.rounds[currentRound-1]`** instead of `combos[currentComboIndex]`. Remove `currentComboIndex` state and per-round advancement logic; `currentRound - 1` is the index. Update the "Next: ..." text on the combo card accordingly.

- [ ] **Replace `formatNotationForSpeech`** with `expandForSpeech` import from `combo-variations`. Prefer the EF-supplied `round.anchor_combo.expanded_speech` over runtime expansion (per v5 §5.10 — runtime expansion races against re-renders).

- [ ] **Classic-mode scheduler (per v5 §5.3):**
  - On round start: bell (existing `playBeep`), then `Speech.speak(anchor_combo.expanded_speech)`.
  - At t=5s: `Speech.speak(classic_description)`.
  - Distribute `classic_reminders` evenly across t=30..t=160 — compute `interval = 130 / (reminders.length + 1)`, place each at `30 + (i+1) * interval` seconds (rounded).
  - At t=170s: bell + `Speech.speak("ten seconds")`.
  - At t=180s: bell.
  - Implementation: extend the existing absolute-wall-clock chained `setTimeout` pattern already used by Dynamic. Compute each delay from `roundStartedAt + offset + pausedAccumMs`. **Do not** chain on `Speech.onDone`.
  - Drop existing `scheduleComboCallouts` (the 25s/40s/55s repetition + "keep going" filler — superseded by structured reminders).

- [ ] **Dynamic-mode scheduler rewrite (v5 §5.4, §5.9 hybrid gap):**
  - Drop fixed cadence. Drop fillers (`TACTICAL_FILLERS`, `MOTIVATIONAL_FILLERS`, the filler schedule refs).
  - Compute initial schedule: `numCalls = min(20, floor((180 - 10) / (estimateSpeechDuration(anchorSpeech, Platform.OS)/1000 + 4)))`. Generate `variations = generateVariations(anchor.notation, numCalls - 1, tier)`. List = `[anchor, ...variations]`.
  - **Anchor reannouncements:** before scheduling, locate the index whose pre-estimated fire-time is closest to t=90s and replace with anchor; same for closest to t=153s.
  - **Hybrid loop per combo:**
    - Set `currentDynamicIdx = 0`. `fireCombo(0)`.
    - `fireCombo(i)`: set `dynamicComboNotation` for visual; compute `estimated = estimateSpeechDuration(combo.expanded_speech, Platform.OS)`; call `Speech.speak(combo.expanded_speech, { onDone })`. Set `primaryTimer = setTimeout(() => fireNext(i), estimated + 4000)` and record `targetTime = now + estimated + 4000`.
    - `fireNext(i)`: if elapsed since round-start > 165000 OR `i+1 >= list.length`, stop. Else `fireCombo(i+1)`.
    - `onDone` handler: if `Date.now() < targetTime`, no-op (primary will fire). Else, clearTimeout(primaryTimer) (no-op if already fired) and schedule next with delay 4000ms — but only if `primaryTimer` hasn't fired yet (track with boolean).
  - At t=170s: bell + "ten seconds". At t=180s: bell.

- [ ] **Pause/resume** (per v5 §5.9):
  - Pause: `Speech.stop()`, record `pausedAt`, clear all pending timeouts (`comboCalloutTimeoutsRef` + `primaryTimerHandle`).
  - Resume: `pausedAccumMs += now - pausedAt`. Reset `pausedAt = null`.
    - **Classic:** recompute schedule from `currentRound`-start + accumulated pause offset. Skip already-fired events (track `nextReminderIdx`).
    - **Dynamic:** re-fire the currently-paused combo from the start (per v5 spec — user was probably mid-execution). Use `fireCombo(currentDynamicIdx)` again.
  - Drop or refactor the existing `dynamicNextIndexRef + scheduleDynamicFromIndex` pattern that pre-schedules all events; the new hybrid loop is one-combo-at-a-time.

- [ ] **`AppState` listener** (per v5 §5.10) — add: on foreground transition, treat as resume (recompute schedule using current `pausedAccumMs`).

- [ ] **Combo card animation** (per v5 §5.11): scale 1 → 1.03 → 1 + brief red border pulse on each TTS fire. Use `react-native-reanimated` (already installed). Trigger via a shared value bumped inside `fireCombo` and the Classic-mode TTS callbacks.

- [ ] **finishWorkout rewrite:**
  - Show rating modal (existing).
  - On submit: map button → `RatingOutcome` (Too Easy=`too_easy`, Just Right=`just_right`, Too Hard=`too_hard`, Skip=`skipped`).
  - Pull progression state from store: `currentLevel`, `currentProgress`, `levelCapStayingSince`, `levelCapTooEasyCountSinceStay`, `demotionWindow`.
  - `result = computeProgression({...})`.
  - `useUserStore.getState().applyProgressionResult(result)` to write atomically.
  - Append `hashCombo(round.anchor_combo.notation)` for each round to `recent_combo_signatures`, truncate to last 10 — write via `upsertUserStats`.
  - Call `upsertUserStats(userId, {... new progression fields ...})` (now writes the 4 new columns).
  - Call `logWorkoutSession` as today (existing flow). Add `difficultyRating` from the button mapping (1/2/3 preserved for back-compat).
  - If `result.shouldShowCelebration`: open `<LevelUpModal />` (deliverable 7). Otherwise call `postWorkoutAd.show(() => navigation.goBack())`.

- [ ] **exitToHome rewrite:**
  - Show rating modal (existing). On submit/skip, outcome is **always** `early_exit` regardless of rating button (per v5 — rating still recorded for sentiment, but progression points are the early_exit floor).
  - Compute progression, write store + DB.
  - **No celebration modal** even if `shouldShowCelebration` is true (UX guardrail).
  - Don't add to local workoutHistory (existing rule preserved).

- [ ] **Refs cleanup.** Delete the filler-related refs (`dynamicFillerScheduleRef`, `dynamicNextFillerIndexRef`). Keep `dynamicNextIndexRef` but it now points to the current combo index, not pre-scheduled offsets. Add `currentDynamicIdxRef`, `primaryTimerHandleRef`, `dynamicTargetTimeRef`, `primaryFiredRef`.

---

## Deliverable 7 — Celebration modal (`mobile/src/components/LevelUpModal.tsx`)

New component. Mounted by TimerScreen when `shouldShowCelebration` is true after a non-early-exit workout.

- [ ] Props: `{ visible, currentLevel, onAdvance, onStay }`. Internally computes `nextLevel = currentLevel === 'beginner' ? 'intermediate' : 'advanced'` and human-cased labels.
- [ ] Layout: full-screen `View` over the existing rating modal pattern (absolute, bg-black/90). Card: dark surface (`bg-[#1A1A1A]`), rounded-3xl, max width 400.
- [ ] Content: headline "You've mastered Beginner." (or Intermediate); subhead "Ready for Intermediate?"; two stacked buttons.
- [ ] Primary button: "Advance to Intermediate" — `bg-boxing-red` (#DC2626) filled, white bold.
- [ ] Secondary button: "Stay at Beginner" — outlined `border-2 border-gray-600`, white text.
- [ ] On mount: `Haptics.notificationAsync(NotificationFeedbackType.Success)`.
- [ ] Light scale animation on the icon via reanimated.
- [ ] On Advance: caller updates store (`boxingLevel = nextLevel`, `nextLevelProgress = max(0, currentProgress - 100)`, clear all level-cap + demotion fields), calls `upsertUserStats`, fires achievement (`level_up_inter` or `level_up_advanced` via `unlockAchievement`), closes modal, proceeds to interstitial.
- [ ] On Stay: caller pins `nextLevelProgress = 100`, sets `levelCapStayingSince = new Date().toISOString()`, resets `levelCapTooEasyCountSinceStay = 0`, persists, closes modal, proceeds to interstitial.
- [ ] Wire achievement firing in TimerScreen.finishWorkout's Advance branch (not in the modal itself — keeps the modal pure).

---

## Deliverable 8 — HomeScreen mode toggle (already done) + Profile demotion hint

- [x] HomeScreen segmented control (shipped in Phase 1 commit `a030f39`).
- [ ] **HomeScreen cleanup:** delete `calculateLevelProgress` (line 93-97). In `loadWorkout`, when calling `upsertUserStats`, pull `nextLevelProgress` from the store (`useUserStore.getState().nextLevelProgress`) instead of computing from workout count. Also pass the new EF inputs (`mode = workoutMode`, `at_level_cap = (levelCapStayingSince !== null)`, `level_cap_too_easy_count_since_stay`, `recent_combo_signatures` — read from `getUserStats` or store).
- [ ] **HomeScreen helper-copy update:** The existing `WorkoutModeToggle.tsx` says "Classic — one combo for the whole round" and "Dynamic — combos rotate within each round". Per v5 §5.11: "Classic — one combo with form coaching" / "Dynamic — combos rotate, real pad work". Update the `HELPER_COPY` map.
- [ ] **`mobile/src/api/workout-generator.ts`** — read first, then update to pass through the new EF inputs (mode, at_level_cap, etc.) and map the new EF response shape into `WorkoutPlan`.
- [ ] **ProfileScreen demotion hint card.** Insert between the "Boxing Level" section (line 410) and "Streaks" section (line 412). Renders only when `demotionWindow.filter(o => o === 'too_hard').length >= 3 && boxingLevel !== 'beginner'`. Card: dark surface, gold border. Text: `"Based on your recent ratings, you might prefer {previousLevel}."` Button: `Drop back to {previousLevel}` — `bg-boxing-gold` (#D4AF37) filled, dark text. On tap: setBoxingLevel(previous), reset all progression state via store mutators + `upsertUserStats`. Toast/alert: "Level updated."
- [ ] **ProfileScreen manual override hardening (v5 §6.7).** Current `handleLevelChange` (line 82-118) does not reset progression. Update it to reset `nextLevelProgress = 0`, clear `levelCapStayingSince`, clear `levelCapTooEasyCountSinceStay`, clear `demotionWindow`. Remove the dead `calculateLevelProgress`-style local computation (the `thresholds`/`progress` block on lines 96-98).

---

## Dead code removal (per v5 §6.8)

- [ ] **`mobile/src/api/database-service.ts:319-357`** `evaluateLevelUp()` — delete entirely (relies on `accuracy` which is always 0 in our submitRating calls).
- [ ] **`mobile/src/api/user-service.ts:69`** `syncUserStats` — remove the hardcoded `nextLevelProgress: 0`. After removal, `upsertUserStats` will not touch the field (let the rating-driven path own it). Also remove `avgAccuracy: 0` (it's pure noise).
- [ ] **`mobile/src/api/user-service.ts:81-107`** `getRecommendedLevel()` — delete entirely (logic moved into `progression.ts`).
- [ ] **`mobile/src/screens/HomeScreen.tsx:93-97`** `calculateLevelProgress` — delete (covered in Deliverable 8 cleanup).
- [ ] **`mobile/src/screens/TimerScreen.tsx:163-173`** `formatNotationForSpeech` — delete (covered in Deliverable 6).
- [ ] **`mobile/src/screens/ProfileScreen.tsx:96-98`** `thresholds` + `progress` computation in `handleLevelChange` — delete (Deliverable 8).

---

## Verification

- [ ] `cd mobile && npx tsc --noEmit` → 0 errors.
- [ ] `cd mobile && bun test src/lib/__tests__/` → all green (extended `combo-variations.test.ts` + new `progression.test.ts`).
- [ ] Migration applied via temp EF → query `information_schema.columns where table_name='punchpal_user_stats'` returns the 4 new columns.
- [ ] Updated `punchpal-generate-workout` deployed → curl with `{mode:'classic'}` returns `schema_version: 2` and a non-empty `classic_description`.
- [ ] Curl with `{mode:'dynamic'}` returns `schema_version: 2` with `classic_description=""` and `classic_reminders=[]`.
- [ ] Curl with beginner level + intermediate-tier embedded tokens → returns 422 (server-side validation rejects).
- [ ] **EAS dev build (Windows, no Xcode flows):**
  - Classic beginner workout: bell at t=0, anchor combo speech, description at t=5, 2-3 form reminders distributed across t=30..t=160, end-of-round at t=170/t=180.
  - Dynamic beginner workout: bell, anchor combo at t=0, no intro speech, rotating combos with ~4s silent gap between each, anchor reannouncements visible at ~90s and ~153s, end-of-round bells.
  - Intermediate workout in Classic: combos contain `slip_*`/`pivot*`/`feint_*` tokens; TTS reads them naturally without stumbling.
  - Advanced workout: long combos with multiple embedded tokens are handled.
  - Mode toggle on Home: switch Classic↔Dynamic, start workout, confirm behavior matches.
  - Rate "Too Easy" 7 times in a row at beginner (each +15 → 105): on the 7th, celebration modal appears.
  - Tap Advance: level becomes intermediate, progress becomes 5 (carry), achievement `level_up_inter` unlocks (visible in checkAchievements pass), next workout generates at intermediate-tier.
  - Reset to beginner manually via Profile; rate "Too Easy" 7 times again; tap Stay this time. Confirm next workout still generates (peak-beginner tier 3) and the EF receives `at_level_cap: true`. Rate "Too Easy" 3 more times → celebration re-fires.
  - Advance to intermediate, then rate "Too Hard" 3 of next 5. Open Profile — demotion hint card appears. Tap it → level reverts to beginner, progress resets, hint disappears.
  - Pause mid-round in Classic → resume → schedule re-anchors with no double-fires. Same in Dynamic — confirm current combo is re-fired from start on resume.
  - Background the app mid-round → foreground → schedule continues correctly.
  - Early exit during a round → rating modal still appears, outcome counted as early_exit (+2), no celebration even if progress would cross 100.

---

## Out of scope (do NOT do)

- Skip Combo button on TimerScreen (Phase 3).
- "Up next" card on TimerScreen.
- Bundling new audio assets.
- AdMob configuration changes (FORCE_TEST_ADS toggle stays as-is per `feedback_force_test_ads_toggle.md`).
- Apple Watch support.
- RevenueCat anything (it was removed; do not reintroduce).
- Auth flow changes.
- Auto-demote (demotion is hint-only — user must tap).
- Celebration modal on early exit (UX guardrail).
- Bumping `version` or `versionCode` in `app.json`.

---

## Review

**Built (Phase 1+2 complete in one pass):**

- **Types (Stage 0):** `mobile/src/types/workout.ts` rewritten — `WorkoutPlan.rounds: Round[]` (was `number`), new `Combo`, `Reminder`, `Round`, `Tier`, `ReminderCategory` types. Replaced the legacy `combos: PunchCombo[]` shape that was scattered across the codebase. Kept `difficulty: BoxingLevel` field name for minimal churn (EF's `level` maps to `difficulty` at the API boundary).
- **Notation library (Deliverable 2):** `mobile/src/lib/combo-variations.ts` extended with full v5 grammar — `Punch | Defense | Footwork | Feint` Token union, strict `parse()` (throws on §7.3 violations), `serialize()`, `expandForSpeech()` (all token types), `estimateSpeechDuration()` (400ms iOS / 435ms Android per word, clamped [1000, 8000]), tier-aware `generateVariations()` (budget 0/2/3 by tier), `hashCombo()` (FNV-1a, 8-char hex). 11 strategies including 3 new tier-gated ones (`insertSlipMid`, `insertPivotEnd`, `insertRollMid`). All 17 existing back-compat tests pass plus 42 new v5 tests = 59 total.
- **Progression (Deliverable 3):** `mobile/src/lib/progression.ts` — pure module. Point values match v5 §6.2. Celebration-trigger logic handles cap-state re-prompt (3 too_easy after Stay), advanced-cap (no celebration ever), demotion window (3+ too_hard in last 5, intermediate+ only). 22 tests cover all branches.
- **Schema migration (Deliverable 1):** `mobile/supabase/migrations/004_progression_columns.sql` historical record + `mobile/supabase/functions/punchpal-migration-004/index.ts` temp EF using `postgresjs` over `SUPABASE_DB_URL`. Idempotent `ADD COLUMN IF NOT EXISTS`. **Not yet deployed/invoked** — user runs `supabase functions deploy punchpal-migration-004 --project-ref zeskhorwddxyjhhnpgsa` then curl invokes once, verifies the four columns exist via the function's own response, then deletes the function locally + from the dashboard.
- **DB service (Deliverable 7 → renumbered):** `mobile/src/api/database-service.ts` — `UserStats` extended with the four new progression fields. `getUserStats`/`upsertUserStats` read+write via `mapRowToStats` + a partial-update record. `upsertUserStats` now does partial updates (only touches keys explicitly passed), so HomeScreen-time syncs don't clobber TimerScreen-time progression writes. `evaluateLevelUp` deleted.
- **User service:** `mobile/src/api/user-service.ts` — `getRecommendedLevel` deleted. `syncUserStats` no longer hardcodes `nextLevelProgress: 0` (the field is owned by `computeProgression` now); the function only writes durable stats (totals, streaks, level).
- **EF rewrite (Deliverable 4):** `mobile/supabase/functions/punchpal-generate-workout/index.ts` — schema v2 output. New inputs (`mode`, `at_level_cap`, `level_cap_too_easy_count_since_stay`, `recent_combo_signatures`). Inlined Deno parser+expander (mirror of mobile lib). Server-side validation: rejects bad grammar, beginner combos with non-punch tokens, out-of-range punch counts; overwrites Claude's `expanded_speech` with deterministic value. Prompt teaches the full v5 grammar (8+6+6 token vocab), §7.3 constraints, mode-specific output requirements (Classic gets description+reminders, Dynamic gets just the anchor), cap-state variety directive, Lomachenko-shuffle note for advanced. Updated `CLAUDE.md` in the function directory with the contract.
- **Client mapper (Deliverable 10):** `mobile/src/api/workout-generator.ts` — passes new EF inputs (mode pulled from store, at_level_cap/capCount/signatures from store inside the function). Maps EF v2 response to `WorkoutPlan` (snake_case → camelCase). Fallback workouts converted to new Round[] shape using the mobile lib's `parse`+`expandForSpeech` so they include all combo metadata.
- **Store (Deliverable 5):** `mobile/src/state/userStore.ts` — added `nextLevelProgress`, `levelCapStayingSince`, `levelCapTooEasyCountSinceStay`, `demotionWindow`, `recentComboSignatures` with composite setters (`applyProgressionResult`, `pushComboSignatures`, `setLevelCapStaying`, `advanceLevel`, `hardResetProgression`, `hydrateProgressionFromDb`). Persist bumped to v2; migrate nulls `currentWorkout` (schema v1 → v2 invalidation) and initializes new fields.
- **WorkoutModeToggle (Deliverable 11):** Helper copy updated to v5 spec ("one combo with form coaching" / "combos rotate, real pad work").
- **LevelUpModal (Deliverable 7 → renumbered to Deliverable 12):** New `mobile/src/components/LevelUpModal.tsx`. Full-screen overlay, achievement-icon scale pulse via reanimated, Advance + Stay buttons with brand-token colors. Pure presentation — caller wires achievements + store mutations.
- **TimerScreen (Deliverable 6 → renumbered to 13):** Full rewrite. Reads `rounds[currentRound-1].anchorCombo` instead of `combos[currentComboIndex]`. **Classic scheduler:** bell at t=0 + `Speech.speak(anchor.expandedSpeech)`, description at t=5s, reminders distributed across [30s, 160s] window, end-of-round bells at t=170s + t=180s. **Dynamic hybrid gap scheduler:** per-combo loop — `estimateSpeechDuration + 4s` primary timer + `Speech.onDone` refinement. If onDone fires before primary's target, no-op (primary handles). If onDone fires after AND primary hasn't fired, cancel and force a 4s gap. If primary already fired, accept the overlap (never stalls on Android even if onDone never fires). Anchor reannouncements at slots closest to t=90s and t=153s. **Pause/resume:** Classic resumes the reminder schedule from the current index. Dynamic re-fires the current combo from the start (per v5 §5.9). **AppState foreground:** recomputes schedule per mode. **finishWorkout:** maps button → RatingOutcome → `computeProgression` → `applyProgressionResult` → `pushComboSignatures` (hashes for every round's anchor, last 10 kept) → `upsertUserStats` → `logWorkoutSession`. Mounts `LevelUpModal` when `shouldShowCelebration`. **Early exit:** outcome is always `early_exit` regardless of rating button choice. No celebration on early exit. Combo card animates via reanimated scale pulse on each TTS fire.
- **HomeScreen (Deliverable 14):** `calculateLevelProgress` deleted. Hydrates progression from DB on userId-known via `getUserStats` → `hydrateProgressionFromDb` (DB wins; falls back to store value). `upsertUserStats` call now writes progression fields from store rather than recomputing from workout count. `generateWorkout` call now passes `workoutMode`.
- **ProfileScreen (Deliverable 15):** Demotion hint card added between "Boxing Level" and "Your Streak" sections — only renders when `demotionWindow` contains 3+ `too_hard` AND boxingLevel != beginner. Dark surface with gold border; gold-filled button "Drop back to {previousLevel}". `handleLevelChange` hardened: now calls `hardResetProgression()` and writes a full reset to Supabase (nextLevelProgress=0, levelCapStayingSince=null, levelCapTooEasyCountSinceStay=0, demotionWindow=[]). Removed the dead `thresholds`/`progress` formula.

**Verification status:**

- [x] `npx tsc --noEmit` — 0 errors.
- [x] `bun test src/lib/__tests__/` — 81 pass (59 combo-variations + 22 progression).
- [ ] Migration applied (user runs the deploy + invoke once).
- [ ] EF deployed (user runs `supabase functions deploy punchpal-generate-workout --project-ref zeskhorwddxyjhhnpgsa`).
- [ ] EAS dev-build manual testing per Verification section above (user runs).

**Deviations from plan, with rationale:**

1. **Did not rename `WorkoutPlan.difficulty` → `level`.** The plan called for this rename but it would have touched ~10 unrelated render sites for nominal value. Kept `difficulty: BoxingLevel` as the client field name; the EF returns `level` which is mapped to `difficulty` at the API boundary. The new fields `tier` and `schemaVersion` were added cleanly.
2. **Progression carry handled via uncapped store, not a separate pending state.** Initial draft of TimerScreen tried to clamp `nextLevelProgress` at 100 in the store, but that loses the overflow needed when Advance is tapped (e.g., progress=90 + JustRight=10 → 100, then +5 → 105; the 5 needs to be the post-advance starting progress). Solved by removing the upper clamp in `applyProgressionResult` and reading `useUserStore.getState().nextLevelProgress` inside `handleAdvance` to compute carry. The progression module itself still pins at 100 for staying users and the advanced cap.
3. **`onDone` "fires after primary timer's target" interpretation.** v5 §5.9 was slightly ambiguous when primary has already fired. Implemented as: if primary already fired (tracked via `dynamicPrimaryFiredRef`), accept the overlap silently. If primary hasn't fired yet (rare — would require speech to extend > estimated+4000ms after the primary scheduled time), cancel the primary and force a clean 4s gap from now. This matches the "never stalls" guarantee while avoiding double-firing the next combo.
4. **WorkoutLibraryScreen "Combos" cell.** This screen is dormant (commented out in HomeScreen). I changed `workout.combos.length` → `workout.rounds.length` to compile, leaving the Rounds and Combos cells showing the same number (one anchor per round in v2). When the library screen is enabled, the cell should be removed or reframed.
5. **Did not add explicit `bun test progression.test.ts` separation in package.json.** The single `bun test` runs all tests under `src/lib/__tests__/`. Both files run in 100ms; no need to split.

**Lessons (added to `tasks/lessons.md`):**

- Avoid clamping computed progression values inside the store setter when the carry overflow drives downstream decisions (level-up math). Clamp at the render boundary or compute the canonical value inside the pure logic module.
- When extending a notation grammar, keep the strict `parse()` separate from a tolerant `tryParse()` helper, then write `expandForSpeech()`/`hashCombo()` on top of `tryParse` so back-compat with legacy test cases (return "" / fall back) survives the grammar change. This let the existing 17 v4 tests pass unmodified while adding 42 v5 tests.
