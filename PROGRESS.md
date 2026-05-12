# PunchPal — Progress

_Last Updated: 2026-05-11 (PM session — AdMob, voice upgrade, Profile cleanup, EAS setup)_

PunchPal is an AI-powered boxing coach for iOS that generates personalized workouts using Claude Sonnet 4.6, tracks user progression across 9 tiers (raw beginner → pro), and delivers verbal cues during timed rounds.

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
- **Monetization:** `react-native-google-mobile-ads` 16.3.x (AdMob — banner + interstitials). RevenueCat REMOVED. App is free forever, ads-only.

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

- **App name on App Store:** PunchPal AI Coach
- **App name in `app.json`:** PunchPal
- **Bundle ID:** `com.punchpal.app`
- **Slug:** `punchpal-ai-coach` (matches Expo project)
- **APP_PREFIX:** `punchpal` (full word, matches other prefixed Stratega apps' convention)
- **ASC Apple ID:** `6756529569`
- **EAS project ID:** `61f19f38-1c99-48db-b8a7-d53d0238a8a5` (`@crisguido/punchpal-ai-coach`)
- **Latest published App Store version:** 1.0.1 (Ready for Distribution)
- **Next target version:** 1.1.0 (build 2) — this session's work

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

### Critical rules (currently 12)
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
- **OnboardingScreen** — two-step flow. Step 1: boxing-level selection (beginner/intermediate/advanced), saves to Supabase. Step 2: optional voice-upgrade tip recommending the **Nathan** premium iOS voice with 4-step Settings instructions, "Open Settings" deep link (`Linking.openSettings()`), and a "Test current voice" preview button. Step 2 auto-skips if user already has a premium English male voice installed.
- **AuthScreen** — optional sign-up/sign-in, opened from Profile. On anonymous-user sign-up, calls `supabase.auth.updateUser({email, password})` to **upgrade** the anon UID (preserves all guest progress). Sign-in uses standard `signInWithPassword`. No email confirmation flow.
- **HomeScreen** — PunchPal logo + title, StreakCard, WorkoutCard, "Get Fresh Workout" regenerate button, **AdMob banner** absolutely positioned above the tab bar via `useBottomTabBarHeight()`. Regenerate button triggers a preloaded AdMob interstitial then loads a fresh workout.
- **TimerScreen** — round timer (3 min work / 1 min rest), combo card with notation (`b` suffix expanded as "to the body" for speech), full description, voice callouts via the coach-voice picker, beep at last 5s of each phase, post-workout rating modal (Too Easy / Just Right / Too Hard / Skip), post-rating AdMob interstitial before navigating Home (suppressed on early-exit flow).
- **ProfileScreen** — boxing level changer, streaks, training stats (workouts / rounds / minutes), workout history with real workout names, account section (anon vs signed-in), delete account, privacy policy link, support link, dev preview button for rating modal. Achievements UI removed; tracking still runs silently in the store.
- **WorkoutLibraryScreen** — implemented but route commented out in `RootNavigator.tsx`
- **(PaywallScreen DELETED — RevenueCat removed entirely)**

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
   - Falls back to hardcoded canned workouts on any error

### Timer flow
- One combo per round (no within-round cycling)
- Voice cadence per combo: name → notation → full description (queued sequentially by Expo Speech) → notation repeats at 25s/40s → "keep going" at 55s
- **Coach voice picker** (`Speech.getAvailableVoicesAsync()` on mount): selects highest-quality male-coach voice in priority order — generic Siri male (Voice 1, `siri_male` identifier pattern) → Nathan → Aaron → Evan → Tom → Reed → Fred → Daniel → first non-default → platform default. Falls back gracefully on devices with no premium voices installed.
- Speech rate slowed to `0.95` for coach cadence; pitch left at default
- `formatNotationForSpeech()` expands `b` suffix to "to the body" so TTS reads naturally
- Beep at restRemaining 1–5 and timeRemaining last 5 of each minute
- Rest phase replaces combo card with big red "REST" + small "Next: <combo>" hint
- After last round: rating modal → `logWorkoutSession()` to Supabase → **AdMob interstitial** (suppressed on early-exit) → navigate Home

### Multi-tenant table access
`mobile/src/lib/tables.ts` exports `TABLES` constant. All `.from()` calls use `TABLES.userStats`, `TABLES.workoutSessions`, `TABLES.comboProgress`. No hardcoded table-name strings in code.

### AdMob integration
- **Library:** `react-native-google-mobile-ads` 16.3.x
- **Placements:**
  - Banner (anchored adaptive) on Home, absolutely positioned above the tab bar
  - Interstitial when "Get Fresh Workout" tapped (preloaded; falls through if not loaded)
  - Interstitial after rating submit/skip on workout completion (suppressed on early-exit)
- **Frequency cap:** 30s minimum between interstitials, shared across all hook instances via module-scope timestamp
- **Non-personalized:** all requests set `requestNonPersonalizedAdsOnly: true`. No ATT prompt, no `expo-tracking-transparency`.
- **Real IDs:** publisher `8632074296834726`, baked into `mobile/src/lib/ads.ts` and `mobile/app.json` plugin config.
- **`FORCE_TEST_ADS` toggle** in `mobile/src/lib/ads.ts` — flip to `true` to force Google test ads even in production builds (replaces the Xcode device-ID capture workflow; user is Windows-only with no Xcode). MUST be `false` before App Store ship.
- **Graceful Expo Go degradation:** `react-native-google-mobile-ads` loaded via `require()` inside try/catch. Native module absent → `adsModule` stays `null` → every public function no-ops, banner returns null, `useInterstitial.show()` immediately fires the dismiss callback. Lets Expo Go iteration keep working post-AdMob-install.
- **Outstanding before full fill rate:**
  - Publish `app-ads.txt` at marketing site root with `google.com, pub-8632074296834726, DIRECT, f08c47fec0942fa0`
  - Update App Privacy questionnaire in App Store Connect → declare AdMob SDK data types under "Third-Party Advertising"

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

### EAS env vars
Set the same two `EXPO_PUBLIC_*` vars in EAS dashboard with **Plain text** visibility (not Secret — `EXPO_PUBLIC_*` are inlined into JS at build time). The existing `punchpal-ai-coach` project already has them set.

### Local dev
```
cd mobile && npx expo start --clear
```
Then scan QR with **Expo Go 54.0.2** on iOS. Cannot use Expo Go SDK 55+ — App Store hasn't shipped that yet. Memory rule saved for this gotcha.

**Expo Go runs the app WITHOUT ads** — the AdMob native module isn't in the Go binary. Everything else (voice, onboarding, timer, profile) works normally. For full ad behavior, build via EAS.

### EAS project
- **Project:** `@crisguido/punchpal-ai-coach` — https://expo.dev/accounts/crisguido/projects/punchpal-ai-coach
- **Project ID:** `61f19f38-1c99-48db-b8a7-d53d0238a8a5`
- **`eas.json` profiles:** `development` (developmentClient + internal), `preview` (internal), `production` (autoIncrement, App Store distribution). Submit profile pre-filled with `ascAppId: "6756529569"`.
- **`cli.appVersionSource: "remote"`** — EAS manages buildNumber centrally; `version` in app.json stays the source of truth.
- **Production iOS build + auto-submit to TestFlight:**
  ```
  cd mobile && eas build --profile production --platform ios --auto-submit
  ```
  First run is interactive — prompts for Apple Developer login + app-specific password (generate at appleid.apple.com → Sign-In and Security → App-Specific Passwords).

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

**This session (2026-05-11 PM — AdMob + voice upgrade + Profile cleanup + EAS setup):**
- **AdMob integration** — added `react-native-google-mobile-ads` 16.3.x with banner on Home and two interstitials (pre-generation + post-workout). 30s shared frequency cap, non-personalized requests, no ATT prompt.
- **`FORCE_TEST_ADS` toggle** — flag in `mobile/src/lib/ads.ts` that forces Google test ads in production builds when set to `true`. Replaces the Xcode device-ID capture workflow because user is Windows-only.
- **Graceful Expo Go degradation for AdMob** — conditional `require()` of GMA with try/catch in `ads.ts`. Native module unavailable → all ad code no-ops → app keeps running in Expo Go without ads. Lets fast dev iteration coexist with a native ad module.
- **RevenueCat removed entirely** — deleted `revenuecatClient.ts`, `PaywallScreen.tsx`, both RC packages from `package.json`, stripped `isPremium` from `Achievement` type + seed data, removed PRO badge UI from Profile. App is now free forever with ads-only monetization.
- **Real AdMob IDs wired** — publisher `8632074296834726`. All 6 IDs (2 App IDs + 4 ad units) in `app.json` plugin config and `mobile/src/lib/ads.ts`. Production builds auto-switch from Google test IDs to real IDs via `__DEV__`.
- **Coach voice picker** in `TimerScreen.tsx` — `Speech.getAvailableVoicesAsync()` on mount picks highest-quality male voice. Priority: generic Siri male (Voice 1) → Nathan → Aaron → Evan → Tom → Reed → Fred → Daniel → first non-default → platform default. Rate slowed to 0.95. Replaces the robotic default Samantha.
- **Onboarding voice tip (step 2)** — added second onboarding step recommending **Nathan** premium iOS voice. 4-step Settings path, "Open Settings" button, "Test current voice" preview. Auto-skips if a premium English male voice is already installed.
- **Profile screen cleanup** —
  - Removed entire Achievements section UI (store-side tracking kept silent in case we want it back)
  - Workout history shows the real workout name (e.g. "Iron Foundation: Pivot Patrol") instead of "Workout #N"
  - Workout name renders on its own row, full width — no truncation, wraps if needed
  - Metadata (rounds / duration / date) moved to second row below the title
  - **Bug fix:** training stats card and history rows were dividing `duration / 60`, but `duration` is already stored in minutes (per `rounds × 3` rule). A 9-minute workout showed as 0. Now displays `duration` directly.
- **EAS project re-linked** — initial `eas init --force` mistakenly created a new empty `punchpal` project. Caught and fixed by changing `slug: "punchpal" → "punchpal-ai-coach"` and clearing `projectId`; user ran `eas init` which auto-detected and linked the existing project (ID `61f19f38-1c99-48db-b8a7-d53d0238a8a5`).
- **Version bump to 1.1.0 (build 2)** in `app.json`. Added `ITSAppUsesNonExemptEncryption: false` to iOS infoPlist to skip the export-compliance prompt on every submit. Updated `eas.json` submit profile with `ascAppId: "6756529569"`.
- **`mobile/README.md` rewritten** — obsolete Vibecode content replaced with current state + brand identity + a "Marketing website requirements (FOR LOVABLE)" section that explicitly includes the `app-ads.txt` deployment requirement so it can be handed to Lovable.

**Previous sessions:**
- Dev preview button in Profile → Account section for the rating modal
- Early-exit rating capture (Exit Workout from pause modal → rating modal → logs to Supabase but skips local history)
- Fixed navigation crash from `navigation.navigate("Home")` — Home is a tab, not a stack screen; switched to `goBack()`
- Loader rewrite: PulsingEnergyLoader uses setInterval-driven inline transform scale after Animated/Reanimated 4/worklets all failed in the RN 0.81 + New Arch + Reanimated 4 + Worklets + NativeWind v4 + React 19 surface
- Duration math fixed in EF: `duration = rounds × 3` (server-side override)
- Switched workout generation from Grok (xAI) to Claude Sonnet 4.6 via Supabase Edge Function
- Multi-tenant prefixing: tables `punchpal_*`, function `punchpal-generate-workout`
- Decoupled from Vibecode template
- Migrated to Expo SDK 54
- Removed auth gate; anonymous-first with optional sign-up
- Notation `b` suffix for body shots, voice expands to "to the body"
- Tier-aware prompt (9 tiers)
- Post-workout rating modal feeds into next generation
- Enriched defensive/footwork vocabulary
- Universal principles block in system prompt
- `combos.length === rounds` enforced
- WorkoutCard responsive redesign
- Timer "REST" banner during rest phase

**Earlier work (visible in `changelog.txt`):** Original Vibecode-template generation in Dec 2025, various iterations through Feb 2026.

---

## Known Issues / TODO

### Outstanding before v1.1.0 ships smoothly
- **Run production build & submit** — `eas build --profile production --platform ios --auto-submit` (interactive Apple login on first run)
- **Publish `app-ads.txt`** on marketing site root with `google.com, pub-8632074296834726, DIRECT, f08c47fec0942fa0`. AdMob fill rate throttled until live and crawled.
- **Update App Privacy questionnaire** in App Store Connect → PunchPal AI Coach → App Privacy. Declare AdMob's data types under "Third-Party Advertising".
- **Stale `extra.grokApiKey` reference in `app.json`** — leftover from Vibecode; harmless but worth deleting next time app.json is edited
- **Delete orphan empty Expo project** `@crisguido/punchpal` (mistakenly created during `eas init --force`). Settings → Delete Project in the dashboard.

### Not yet wired but schema-ready
- `combo_progress` table — never written to. Would enable per-combo struggle detection without rating UI.
- `workout_sessions.accuracy` — always 0; no input mechanism (boxers shadow-box, can't auto-measure)

### Vibecode leftovers (non-blocking)
- `mobile/src/api/image-generation.ts` — hits `api.vibecodeapp.com`, not in use anywhere
- `mobile/src/api/transcribe-audio.ts` — same pattern, not in use
- `mobile/src/api/chat-service.ts` — wraps Grok/OpenAI clients, not invoked anywhere

### Cosmetic
- `WorkoutLibraryScreen` is implemented but route is commented out
- Onboarding doesn't ask the user how many years of training they have (only level)

### Architectural ideas (discussed, not built)
- DB-driven technique vocabulary (move per-level defense/footwork strings into a Supabase table for live edits)
- Weekly Claude curator job that proposes prompt refinements based on aggregate rating distribution
- Prompt caching on the EF (stable boxing-knowledge prefix) for ~80% latency reduction
- OpenAI TTS (`tts-1-hd` with "onyx") pre-generated at workout-creation time — escalation path if iOS premium voices still feel robotic

---

## Decisions Logged

- **Claude Sonnet 4.6 (not Opus 4.7)** — chosen for cost/quality balance on structured creative output; user explicitly requested it
- **Expo SDK 54 (not latest npm)** — pinned to match App Store Expo Go's max-supported SDK
- **Shared Supabase project with `punchpal_` prefix** — matches Stratega multi-tenant convention
- **JWT verification ON for EF** — anonymous sessions still authenticate via gateway; secure-by-default
- **`combos.length === rounds`** — one combo per round, server reconciles drift, math matches what user experiences
- **Post-workout rating instead of per-combo** — minimum friction; per-combo would be too tappy
- **No combo persistence for "don't repeat" enforcement** — relies on workout-name list + temperature variety
- **Partial workouts ARE rated but DON'T count toward stats** — early exits feed Claude difficulty signal (Supabase) but skip local history/streak/achievements
- **AdMob-only monetization, no RevenueCat, no paywalls** — user explicitly chose free-forever-with-ads over freemium. RevenueCat removed wholesale rather than left dormant.
- **Non-personalized ads only (no ATT prompt)** — chose cleaner first-run experience over higher CPMs. Revisit if revenue underperforms.
- **`FORCE_TEST_ADS` boolean toggle** — replaces the standard "capture device ID via Xcode console" flow because user is Windows-only with no Xcode access
- **Conditional `require()` pattern for native AdMob module** — preserves Expo Go iteration speed; static GMA imports crash Expo Go via `TurboModuleRegistry.getEnforcing`
- **Coach voice priority: generic Siri male first, then named voices starting with Nathan** — user confirmed Voice 1 sounds best on their device but is unnamed, so picker tries Voice 1 first while onboarding tip recommends Nathan (a real name users can find in Settings)
- **Achievements UI removed but underlying tracking kept** — user wanted the visual section gone; the achievement system in the store still runs silently, ready to re-render later

---

## Lessons Captured (Memory)

Saved to user-global memory (`~/.claude/projects/<...>/memory/`):
- **Expo SDK targeting**: never `expo@latest` for Expo-Go-tested projects; verify App Store version via iTunes lookup API first
- **Coach voice priority on user's iPhone**: Siri Voice 1 (generic male) beats Nathan premium; Aaron is NOT installed on this device
- **Native modules + Expo Go**: when adding GMA / RevenueCat / etc. to a project still tested via Expo Go, wrap require() in try/catch and guard everything — static imports trigger TurboModule crashes
- **`FORCE_TEST_ADS` toggle in PunchPal**: must flip to `false` before App Store submission; documented because user is Windows-only and skips device-ID capture
- **User is Windows-only — never suggest Xcode / Mac / Apple Devices flows**: relevant across all Stratega projects; for iOS debugging prefer in-app debug UI, build-time flags, EAS dashboard logs, or Settings → Privacy → Analytics Data

---

## Quick Reference

| Want to... | File / command |
|---|---|
| Change combo generation rules | `mobile/supabase/functions/punchpal-generate-workout/index.ts` |
| Add a new defensive technique | edit `levelGuidelines` in that file, redeploy EF |
| Add a new table column | new migration in `mobile/supabase/migrations/` + deploy temp EF to apply |
| Adjust mobile UI for a screen | `mobile/src/screens/` |
| Change voice cadence | `scheduleComboCallouts` in `TimerScreen.tsx` |
| Change which coach voice gets picked | `preferOrder` array + `pickSiriMale` in `TimerScreen.tsx` |
| Toggle test ads for personal TestFlight testing | flip `FORCE_TEST_ADS` in `mobile/src/lib/ads.ts` |
| Change ad placements / frequency cap | `mobile/src/lib/ads.ts` + call-sites in `HomeScreen.tsx` / `TimerScreen.tsx` |
| Update progression tiers | `computeTier()` in the EF |
| Deploy EF | `supabase functions deploy punchpal-generate-workout --project-ref zeskhorwddxyjhhnpgsa` |
| Run locally (no ads) | `cd mobile && npx expo start --clear`, scan with Expo Go iOS |
| Build for TestFlight | `cd mobile && eas build --profile production --platform ios --auto-submit` |
