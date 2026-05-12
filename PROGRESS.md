# PunchPal — Progress

_Last Updated: 2026-05-11_

PunchPal is an AI-powered boxing coach for iOS that   i dont have aaron on my generates personalized workouts using Claude Sonnet 4.6, tracks user progression across 9 tiers (raw beginner → pro), and delivers verbal cues during timed rounds.

---

## Repository Layout

```
PunchPal/
├── mobile/                 ← Expo / React Native iOS app
├── backend/                ← Hono/Bun web service (sample only, not LLM)
└── PROGRESS.md             ← this file
```

The mobile app is what ships. The `backend/` folder is a leftover Vibecode template — not active.

---

## Tech Stack

### Mobile (`mobile/`)
- **Runtime:** Expo SDK 54 (`expo@54.0.34`), React Native 0.81.5, React 19.1
- **Language:** TypeScript 5.9 (strict mode)
- **Package manager:** bun
- **Navigation:** `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- **Styling:** NativeWind v4 + Tailwind v3, with `babel-preset-expo` + `nativewind/babel` preset
- **State:** Zustand with AsyncStorage persistence
- **Animations:** Legacy RN `Animated` (Reanimated 4.1 installed but unused so far)
- **Audio:** `expo-av` + `expo-speech` for combo callouts and beeps
- **Haptics:** `expo-haptics` throughout
- **Backend client:** `@supabase/supabase-js` 2.87
- **Monetization (wired but not gated):** `react-native-purchases` (RevenueCat)

### Server (Supabase Edge Functions)
- **Runtime:** Deno (Supabase Edge Runtime)
- **LLM SDK:** `npm:@anthropic-ai/sdk@0.95.1`
- **Postgres client:** `https://deno.land/x/postgresjs@v3.4.4` (used only for one-off migration EFs)
- **Default LLM:** `claude-sonnet-4-6` with `temperature: 0.8`, `max_tokens: 4096`, `output_config: { format: { type: "json_schema", schema } }`

### Database
- **Shared Supabase project:** `zeskhorwddxyjhhnpgsa` (`https://zeskhorwddxyjhhnpgsa.supabase.co`)
- Multi-tenant — co-hosts other Stratega apps (pawlogix, hiitopia, saint-match, etc.). All PunchPal tables and functions prefixed `punchpal_*` / `punchpal-*`.

---

## Project Identity

- **App name:** PunchPal
- **Bundle ID:** `com.punchpal.app`
- **Slug:** `punchpal`
- **APP_PREFIX:** `punchpal` (full word, matches other prefixed Stratega apps' convention)

---

## Database Schema

All tables on the shared Supabase project under `public` schema, prefixed `punchpal_`. RLS enabled; policies scope rows by `user_id = auth.uid()::text`.

### `punchpal_user_stats`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text unique | matches Supabase auth UID |
| `total_workouts` | int | local mirror of zustand history count |
| `total_minutes` | int | summed workout duration |
| `current_level` | text | `beginner` / `intermediate` / `advanced` |
| `next_level_progress` | float | 0–100, used for tier calculation |
| `combos_learned` | int | distinct combos completed |
| `current_streak` | int | days |
| `longest_streak` | int | days |
| `avg_accuracy` | float | 0–100 |
| `last_workout_date` | timestamptz | |
| timestamps | | |

### `punchpal_workout_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text FK → user_stats | ON DELETE CASCADE |
| `workout_name` | text | |
| `difficulty` | text | |
| `duration`, `rounds`, `duration_minutes` | int | |
| `combos_attempted`, `combos_completed` | int | |
| `accuracy` | float | not currently populated (no input mechanism) |
| `notes` | text | nullable |
| `difficulty_rating` | smallint | 1=too easy, 2=just right, 3=too hard (post-workout rating) |
| `completed_at` | timestamptz | |
| `created_at` | timestamptz | |

### `punchpal_combo_progress`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text FK | |
| `combo_notation` | text | |
| `combo_name` | text | |
| `times_attempted`, `times_completed` | int | |
| `best_accuracy` | float | |
| `last_attempt_date` | timestamptz | |
| UNIQUE(user_id, combo_notation) | | |

_Schema-level support exists; not yet wired from the mobile app post-workout._

### Migrations
- `001_init_schema.sql` — original tables (bare names)
- `002_prefix_tables.sql` — rename to `punchpal_*` (idempotent, applied via temp EF)
- `003_add_difficulty_rating.sql` — added `difficulty_rating` to sessions (applied via temp EF)

> `supabase db push` is blocked by foreign migrations on the shared project. Migrations are applied via temp Edge Functions that connect to `SUPABASE_DB_URL` and run SQL directly. The temp EFs are deleted after use.

---

## Edge Functions

Only one deployed: **`punchpal-generate-workout`**.

### Endpoint
`POST https://zeskhorwddxyjhhnpgsa.supabase.co/functions/v1/punchpal-generate-workout`
- JWT verification ON (default). Mobile passes session JWT automatically via `supabase.functions.invoke()`.
- Anonymous sessions accepted.

### Request body
```ts
{
  boxingLevel: "beginner" | "intermediate" | "advanced",
  workoutType?: "quick" | "power" | "endurance" | "technique",
  workoutHistory: number,                  // total prior workout count
  userStats?: UserStats | null,
  recentSessions?: RecentSession[]         // last 5 with ratings
}
```

### Response
```ts
{
  name: string,                             // "Two Word Style: Rest of Name"
  duration: number,                         // minutes
  rounds: number,
  combos: { name, notation, description }[] // length === rounds
}
```

### Internal flow
1. Read `ANTHROPIC_API_KEY` from secrets
2. Parse + validate request body
3. Build system prompt (universal principles, level vocabularies, critical rules)
4. Build user prompt (tier guidance, recent history with ratings, personalization)
5. Call Claude Sonnet 4.6 with `output_config.json_schema` enforcing combo shape
6. Filter out combos that violate punch-count range for the level
7. Reconcile `combos.length` to equal `rounds` (trim excess or shrink rounds)
8. Return JSON to mobile

### Secrets (set on project)
- `ANTHROPIC_API_KEY` — real `sk-ant-…` key
- Standard auto-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`

---

## AI Prompt Architecture

### Boxing notation
`1`=Jab, `2`=Cross, `3`=Lead Hook, `4`=Rear Hook, `5`=Lead Uppercut, `6`=Rear Uppercut. Lowercase `b` suffix = punch to body (e.g., `1-2b-3` = jab, cross to body, lead hook to head).

### Universal principles block (system prompt)
Applies to every workout regardless of level:
- Range awareness (jab range / mid / in-fighting)
- Eye discipline (chest/sternum, not fists)
- Breathing (sharp exhale on commit punches)
- Setup vs commit punch distinction
- Rhythm — steady default, broken rhythm at intermediate+
- Always reset (defend AND reposition after commit punch)
- "Loading the hip" kinetic engine for catch-and-counter

### Per-level vocabularies

**Beginner** — fundamentals: slip L/R, pull back, high guard, chin tucked, elbows tight, eyes on chest, return to guard. Footwork: step forward/back, lateral step, pivot, find jab range.

**Intermediate** — counter-fighting tools: slip-and-counter, roll under hook L/R, parry-counter, pull-counter, shoulder roll, double jab, counter-jab/cross/hook, hand-fight, **catch and shoot** (parry with one hand → return with other), **block and counter to body** (same-side elbow → torso compresses → same-arm return), feints (jab/cross/level-change/shoulder), pendulum step, frame-and-step-out.

**Advanced** — pro toolkit: full shoulder roll, Philly shell, check hook, pull-shift, **absorb-and-rip** (James Toney signature: catch with elbow, compress and rotate INTO punch, uncoil and rip same-side hook), **shell-and-rip**, **parry-and-cross**, guard trap, hand-fight to liver setup, stutter-feint, broken-rhythm counter (slow-slow-fast). Footwork: cut angle mid-combo, switch stance, L-step, lateral pivot-counter (Usyk), stutter-step explode, frame-and-rotate exit.

### 9-tier progression (within levels)

Tier derived from `currentLevel × nextLevelProgress`:

| Tier | Stage | Character |
|---|---|---|
| 1 | Raw beginner (0–33%) | 4–5 combos, only 1-2 / 1-1-2 / 1-2-3, repetition over variety |
| 2 | Mid beginner (34–66%) | 5–6 combos, intro pivot + lateral step |
| 3 | Late beginner (67–100%) | First uppercut, simple feints — bridge to intermediate |
| 4 | Early intermediate | 3-punch dominant, slip-and-counter, first body shots |
| 5 | Mid intermediate | 4-punch dominant, multiple feints, broken rhythm |
| 6 | Late intermediate | 5-punch, punch-specific counters, pendulum step |
| 7 | Early advanced | 5–6 punch, multi-level head-body, check hooks |
| 8 | Mid advanced | 6–7 punch, signature pro patterns (Crawford/Inoue/Loma), Philly shell, guard traps |
| 9 | Pro | 7–8 punch with multi-range transitions, full fight scenarios |

### Critical rules (currently 11)
1. Punch-count per combo is mandatory (level-specific ranges, enforced server-side)
2. Every description must include ≥1 defensive movement AND ≥1 footwork cue
3. Each combo feels different and realistic for the level
4. Body shots must use `b` suffix
5. Vary combinations within workout
6. Motivating workout names
7. Workout type guidance must be followed
8. Workout name format: `"Two Word Style: Rest of Name"`
9. **Variety:** each combo teaches a distinct concept; no two combos in workout share opening 2 punches; never reuse workout names from recent history
10. **Realism:** real coach, mechanically possible, used by actual fighters, teaches something tier-appropriate
11. **Progression:** match the tier exactly; user must feel the jump when tier increments
12. **Round-combo pairing:** `combos.length === rounds`; server reconciles if violated

### Recent feedback loop (rating → next workout)
If user rated ≥2 of last 5 workouts "Too Easy" → push UPPER end of complexity range.
If ≥2 "Too Hard" → drop to LOWER end, favor fundamentals.
Mixed → median complexity with fresh combinations.

---

## Mobile App Features

### Screens
- **SplashScreen** — animated logo, kicks off `initializeUser()` for anonymous Supabase session, routes to Onboarding or MainTabs based on `hasCompletedOnboarding`
- **OnboardingScreen** — boxing-level selection (beginner/intermediate/advanced), saves to Supabase
- **AuthScreen** — optional sign-up/sign-in, opened from Profile. On anonymous-user sign-up, calls `supabase.auth.updateUser({email, password})` to **upgrade** the anon UID (preserves all guest progress). Sign-in uses standard `signInWithPassword`. No email confirmation flow (project has confirmations disabled).
- **HomeScreen** — workout card (PunchPal logo + title + workout details), StreakCard, WorkoutCard, "Get Fresh Workout" regenerate button
- **TimerScreen** — round timer (3 min work / 1 min rest), combo card with notation (`b` suffix expanded as "to the body" for speech), full description, voice callouts, beep at last 5s of each phase, post-workout rating modal (Too Easy / Just Right / Too Hard / Skip)
- **ProfileScreen** — boxing level changer, streaks, training stats, achievements, account section (shows "Create Account / Sign In" if anonymous, email + "Sign Out" if signed in), delete account, privacy policy, support
- **PaywallScreen** — RevenueCat-wired (not currently gated; app is free)
- **WorkoutLibraryScreen** — currently hidden via commented-out route

### Auth flow
- Anonymous-first. Splash kicks off `supabase.auth.signInAnonymously()` in background.
- No gate. Sign-up is OPTIONAL via Profile screen.
- Anonymous → real account upgrade via `updateUser({email, password})` preserves UID and all data.

### Workout generation flow
1. HomeScreen `loadWorkout()` syncs `userStats` to Supabase
2. Calls `generateWorkout(level, history, type, userId)` in `mobile/src/api/workout-generator.ts`
3. That function:
   - Verifies Supabase enabled
   - Ensures auth session exists (creates anonymous if not)
   - Fetches `userStats` + last 5 `workout_sessions` (with ratings)
   - Invokes `punchpal-generate-workout` EF
   - Falls back to hardcoded canned workouts (in `workout-generator.ts`) on any error

### Timer flow
- One combo per round (no within-round cycling)
- Voice cadence per combo: name → notation → full description (queued sequentially by Expo Speech) → notation repeats at 25s/40s → "keep going" at 55s
- Speech `formatNotationForSpeech()` expands `b` suffix to "to the body" so TTS reads naturally
- Beep at restRemaining 1–5 and timeRemaining last 5 of each minute
- Rest phase replaces combo card with big red "REST" + small "Next: <combo>" hint
- After last round: rating modal → `logWorkoutSession()` to Supabase → navigate Home

### Multi-tenant table access
`mobile/src/lib/tables.ts` exports `TABLES` constant. All `.from()` calls use `TABLES.userStats`, `TABLES.workoutSessions`, `TABLES.comboProgress`. No hardcoded table-name strings in code.

### Boxing level → tier display
On Home, the level appears inside the WorkoutCard as the eyebrow above the workout name (colored by difficulty).

### Responsive layout
- All screens use `useSafeAreaInsets` for top/bottom padding within ScrollView
- WorkoutCard, Timer combo card, OnboardingScreen all sized to fit iPhone 15 / 16 / 16 Pro Max without scroll
- Timer combo notation uses `adjustsFontSizeToFit` for long combos like `1-1-2-5-6-3-2`

---

## Environment / Deployment

### Mobile `.env` (gitignored)
```
EXPO_PUBLIC_SUPABASE_URL=https://zeskhorwddxyjhhnpgsa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<jwt>
```

### EAS (when building):
Set the same two `EXPO_PUBLIC_*` vars in EAS dashboard with **Plain text** visibility (not Secret — `EXPO_PUBLIC_*` are inlined into JS at build time).

### Local dev
```
cd mobile && npx expo start --clear
```
Then scan QR with **Expo Go 54.0.2** on iOS. Cannot use Expo Go SDK 55+ — App Store hasn't shipped that yet. Memory rule saved for this gotcha (`~/.claude/projects/.../memory/feedback_expo_sdk_targeting.md`).

### Deploying EF changes
```
cd mobile
supabase functions deploy punchpal-generate-workout --project-ref zeskhorwddxyjhhnpgsa
```

### Schema changes
- Add migration to `mobile/supabase/migrations/`
- Apply via temporary Edge Function using `SUPABASE_DB_URL` (since `supabase db push` is blocked by sibling apps' migrations on the shared project)
- Delete the temp EF after migration applied

---

## What's Been Done (Recent History)

**Since last PROGRESS sync:**
- **Dev preview button** in Profile → Account section: "DEV: Preview Rating Modal" opens the rating UI standalone (no Supabase write) for quick design iteration. Easy to remove later.
- **Early-exit rating capture**: tapping "Exit Workout" in the pause modal now triggers the same rating modal instead of immediately going back. Skip + 3 difficulty buttons available. Logs to `punchpal_workout_sessions` so Claude gets the signal from incomplete sessions too — but does NOT add to local workoutHistory, so partial workouts don't count toward streak/totals/achievements.
- **Fixed navigation crash**: `navigation.navigate("Home")` was throwing "no navigator handles this" — Home is a tab inside MainTabs, not a stack screen. Switched to `goBack()` in `submitRating`/`skipRating`.
- **Loader rewrite**: PulsingEnergyLoader rebuilt to use the boxing-glove logo with breathing scale + opacity animation. Centered via `flex-1` + `flexGrow: 1` on ScrollView. After 6 failed attempts using `Animated`, `Reanimated 4`, worklets babel plugin, and various combinations — discovered the host stack (RN 0.81 + New Arch + Reanimated 4 + Worklets + NativeWind v4 + React 19) silently breaks both `Animated.loop` and Reanimated worklets in this surface. Solution: pure `useState` + `setInterval` driven re-renders applying inline `transform.scale`. Bypasses every animation library entirely.
- **Duration math fixed**: EF was returning AI's loose duration estimate (e.g., 30 min for a 6-round workout). Now overrides server-side: `duration = rounds × 3` (just work time, matches user mental model where each round = 3 min).

**This session/week:**
- Switched workout generation from Grok (xAI) to Claude Sonnet 4.6 via Supabase Edge Function (key never enters mobile bundle)
- Multi-tenant prefixing: tables `punchpal_*`, function `punchpal-generate-workout`
- Fixed pre-existing camelCase column name bugs in `database-service.ts`
- Decoupled from Vibecode template — removed patches, `@vibecodeapp/sdk`, version overrides, Vibecode metro wrapper
- Migrated to Expo SDK 54 (originally 53; tried 55, downgraded because App Store Expo Go max is 54)
- Removed auth gate; anonymous-first with optional sign-up from Profile (preserves UID via `updateUser`)
- Notation `b` suffix for body shots, voice expands to "to the body"
- Tier-aware prompt (9 tiers from raw beginner to pro)
- Post-workout rating modal (Too Easy / Just Right / Too Hard); feedback fed back into next generation
- Enriched defensive/footwork vocabulary including catch-and-shoot, absorb-and-rip, parry-and-cross
- Universal principles block (range, eye discipline, breathing, setup-vs-commit, rhythm, loading the hip)
- `combos.length === rounds` enforced — one combo per round, no within-round cycling
- WorkoutCard responsive redesign: training level inside card (eyebrow above name), Duration + Rounds boxes only, centered fixed-width pill style
- Timer screen "REST" banner during rest phase replacing combo card

**Earlier work (visible in `changelog.txt`):**
- Original Vibecode-template generation in Dec 2025
- Various iterations through Feb 2026

---

## Known Issues / TODO

### Not yet wired but schema-ready
- `combo_progress` table — never written to. Would enable per-combo struggle detection without rating UI.
- `workout_sessions.accuracy` — always 0; no input mechanism (boxers shadow-box, can't auto-measure)

### Vibecode leftovers (non-blocking)
- `mobile/src/api/image-generation.ts` — hits `api.vibecodeapp.com` (Vibecode's hosted image gen endpoint, not in use anywhere)
- `mobile/src/api/transcribe-audio.ts` — same pattern (not in use)
- `mobile/src/api/chat-service.ts` — wraps Grok/OpenAI clients, not invoked anywhere

### Cosmetic
- The `WorkoutLibraryScreen` is implemented but route is commented out
- Onboarding doesn't ask the user how many years of training they have (only level)

### Architectural ideas (discussed, not built)
- DB-driven technique vocabulary (move per-level defense/footwork strings into a Supabase table for live edits)
- Weekly Claude curator job that proposes prompt refinements based on aggregate rating distribution
- Prompt caching on the EF (stable boxing-knowledge prefix) for ~80% latency reduction

---

## Decisions Logged

- **Claude Sonnet 4.6 (not Opus 4.7)** — chosen for cost/quality balance on structured creative output; user explicitly requested it
- **Expo SDK 54 (not latest npm)** — pinned to match App Store Expo Go's max-supported SDK
- **Shared Supabase project with `punchpal_` prefix** — matches Stratega multi-tenant convention
- **JWT verification ON for EF** — anonymous sessions still authenticate via gateway; secure-by-default
- **`combos.length === rounds`** — one combo per round, server reconciles drift, math matches what user experiences
- **Post-workout rating instead of per-combo** — minimum friction; per-combo would be too tappy
- **No combo persistence for "don't repeat" enforcement** — relies on workout-name list + temperature variety; revisit if user feels staleness
- **Partial workouts ARE rated but DON'T count toward stats** — early exits feed Claude difficulty signal (Supabase) but skip local history/streak/achievements; only completed workouts contribute to progression

---

## Lessons Captured (Memory)

Saved to user-global memory (`~/.claude/projects/<...>/memory/`):
- **Expo SDK targeting**: never `expo@latest` for Expo-Go-tested projects; verify App Store version via iTunes lookup API first

---

## Quick Reference

| Want to... | File / command |
|---|---|
| Change combo generation rules | `mobile/supabase/functions/punchpal-generate-workout/index.ts` |
| Add a new defensive technique | edit `levelGuidelines` in that file, redeploy EF |
| Add a new table column | new migration in `mobile/supabase/migrations/` + deploy temp EF to apply |
| Adjust mobile UI for a screen | `mobile/src/screens/` |
| Change voice cadence | `scheduleComboCallouts` in `TimerScreen.tsx` |
| Update progression tiers | `computeTier()` in the EF |
| Deploy EF | `supabase functions deploy punchpal-generate-workout --project-ref zeskhorwddxyjhhnpgsa` |
| Run locally | `cd mobile && npx expo start --clear`, scan with Expo Go iOS |
