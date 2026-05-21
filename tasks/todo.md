# Phase 1 — Dynamic Mode (Client-Side)

Source: `Shadow boxing teardown v4` (§5) + `mobile/Phase 1 build prompt`.
Goal: rotating combos within a round at tier-aware cadence. Existing users keep Classic; new users default to Dynamic. No Edge Function / schema / audio-asset changes.

## Stage 1 — Combo variation generator + tests

- [x] Create `mobile/src/lib/combo-variations.ts` with `generateVariations` (deterministic via mulberry32) and `expandForSpeech`.
- [x] Implement 9 strategy functions (drop-last, drop-first, bodify-last, bodify-middle, prefix-jab, append-lead-hook, append-lead-uppercut, bodify-index-one, swap-last-to-body).
- [x] Validity rules: numbers 1–6, no three identical in a row, no 6-token alternation, no doubled rear punch at start.
- [x] `expandForSpeech` rules: 1–6 → number words, `b` suffix → " to the body", `, ` separator.
- [x] Add `mobile/src/lib/__tests__/combo-variations.test.ts` (bun test, 17 cases).
- [x] Add `"test": "bun test"` to `mobile/package.json`.
- [x] Exclude `**/__tests__/**` from `tsconfig.json` so tsc doesn't typecheck bun:test imports.

## Stage 2 — userStore migration

- [x] Add `workoutMode: "classic" | "dynamic"`, `workoutModeMigratedAt: string | null`, `setWorkoutMode` setter.
- [x] Add persist `version: 1` + `migrate(state, fromVersion)` — existing users (hasCompletedOnboarding === true) → Classic; everyone else → Dynamic. Stamp `workoutModeMigratedAt`.
- [x] Defensive stamp inside `setHasCompletedOnboarding`: fresh installs that complete onboarding without ever having a persisted state get stamped Dynamic at that moment.
- [x] Export `WorkoutMode` type for use in components.

## Stage 3 — Segmented control + HomeScreen

- [x] Create `mobile/src/components/WorkoutModeToggle.tsx` — two `Pressable` segments, boxing-red active, white/60 inactive, uppercase + `tracking-widest`, height 36, rounded-lg, boxing-cardBorder border, 150ms color transition, light haptic on tap, helper text below.
- [x] Insert `<WorkoutModeToggle />` between `<StreakCard />` and `<WorkoutCard />` on `HomeScreen.tsx`. ScrollView already exists; no scroll changes needed.

## Stage 4 — TimerScreen Dynamic scheduler

- [x] Add `workoutMode` + `boxingLevel` selectors.
- [x] Add `dynamicComboNotation` state + scheduling refs (`roundStartedAtRef`, `pausedAtRef`, `pausedAccumMsRef`, `dynamicScheduleRef`, `dynamicFillerScheduleRef`, `dynamicNextIndexRef`, `dynamicNextFillerIndexRef`, `isRunningRef`, `isPausedRef`).
- [x] Sync `isRunning` / `isPaused` state into refs via useEffects (chained setTimeout callbacks read refs, not stale state).
- [x] `cadenceFor(level)` helper — Beginner 45s / Intermediate 28s / Advanced 18s. `null` → intermediate.
- [x] `scheduleDynamicCallouts(anchor)` — computes numCalls (`Math.min(9, Math.floor(161/cadence)+1)`), generates variations, builds schedule + filler schedule, sets `dynamicComboNotation` to anchor, calls `scheduleDynamicFromIndex(0,0)`.
- [x] `scheduleDynamicFromIndex(comboStart, fillerStart)` — single chained `setTimeout` against `roundStartedAt + offset + pausedAccumMs`; setTimeout callbacks bail if not running or paused; increments `dynamicNextIndexRef` / `dynamicNextFillerIndexRef` on fire.
- [x] Branch in the comboKey effect: Dynamic → `scheduleDynamicCallouts(combo.notation)`; Classic → `setDynamicComboNotation(null)` + `scheduleComboCallouts(...)`. Include `workoutMode` in the comboKey so a mode toggle re-schedules.
- [x] Pause: `toggleRunning` records `pausedAtRef = Date.now()` on enter. Resume: `isPaused` sync useEffect adds `(now - pausedAtRef)` to `pausedAccumMsRef` and calls `scheduleDynamicFromIndex(nextIdx, nextFillerIdx)`.
- [x] Combo card JSX branches: Dynamic shows `dynamicComboNotation` (anchor on round start, then each variation as it fires). Classic JSX unchanged.

## Stage 5 — tasks/ scaffolding

- [x] Create `tasks/todo.md` (this file).
- [x] Create `tasks/lessons.md` scaffold.

## Verification

- [x] `bunx tsc --noEmit` → 0 errors.
- [x] `bun test src/lib/__tests__/combo-variations.test.ts` → 17/17 pass.
- [ ] **EAS dev build (Windows-only, no Expo Go)** — pending user run:
  - Existing user (preserved AsyncStorage): Home shows Classic active; helper text correct; round timer + 25s/40s/55s callouts unchanged.
  - Fresh install (uninstall + reinstall): Home shows Dynamic active by default after onboarding completes.
  - Toggle Classic↔Dynamic, restart app, persistence confirmed.
  - Dynamic at Beginner: ~4 combos in 3 min (45s cadence).
  - Dynamic at Intermediate: ~6 combos in 3 min (28s cadence).
  - Dynamic at Advanced: ~9 combos in 3 min (18s cadence).
  - Pause mid-round 30s → resume → schedule re-anchors with no double-fires.
  - Toggle Dynamic → Classic on Home, start workout → Classic behavior runs.
- [ ] Visual: iPhone 14 / 15 / 16 / Pro Max via Expo Dev Tools — HomeScreen content + banner ad render without overlap.

## Review

**Built:**

- `mobile/src/lib/combo-variations.ts` — pure-TS, deterministic generator + speech-expander. 9 strategies, validity gates, 17 unit tests via `bun test`.
- `mobile/src/state/userStore.ts` — added `workoutMode` + `workoutModeMigratedAt`, persist `version: 1` with migrate. Existing users → Classic; new users → Dynamic.
- `mobile/src/components/WorkoutModeToggle.tsx` — new segmented control matching brand tokens.
- `mobile/src/screens/HomeScreen.tsx` — toggle inserted between StreakCard and WorkoutCard.
- `mobile/src/screens/TimerScreen.tsx` — branched scheduler. Classic path byte-identical (only the comboKey now includes `workoutMode`). Dynamic path: absolute-wall-clock chained `setTimeout`, tier-driven cadence, 2 fillers per round (tactical at `cadence*0.6+4`, motivational at 122s), pause/resume re-anchoring via `pausedAccumMsRef`.
- `mobile/tsconfig.json` — excluded `**/__tests__/**` so `tsc --noEmit` ignores `bun:test` imports.
- `mobile/package.json` — added `"test": "bun test"`.

**Known gaps / deferred:**

- Cadence values use `boxingLevel` only (Beginner/Intermediate/Advanced) — the Phase 1 spec's 9-tier mapping all collapses to one cadence per level, so we don't fetch `userStats.next_level_progress` from Supabase in Phase 1. If tier 1–9 ever drives anything beyond cadence (e.g., variation count tweaks), add the Supabase fetch then.
- 150ms "slide-to-active" animation uses NativeWind `transition-colors duration-150` — if RN doesn't honor this, the segment color swap is instant. Polish-only; not blocking.
- The `formatNotationForSpeech` helper inside `TimerScreen.tsx` is still used by the Classic schedule. Not consolidated with `expandForSpeech` because Classic path is intentionally unchanged in Phase 1.
- Edge function / schema / `app.json` / EAS not touched, per Phase 1 scope.
- No Skip-combo button; no Up Next preview; no pre-warning audio — all deferred to Phase 2/3 per v4 §5.12.
