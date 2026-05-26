# PunchPal AI Coach

An **iOS + Android** app that generates personalized boxing workouts on demand, powered by Claude Sonnet 4.6. Built for solo boxers who want a coach in their pocket — without the cost of a real one.

**Live on the App Store. Shipping to Google Play.**
Bundle ID / Package: `com.punchpal.app` (identical on both platforms)

---

## What it does

PunchPal replaces the "I'll just shadow-box for 20 minutes" problem with a structured, fresh-every-time workout that adapts to the user's skill level and recent feedback. Tap a button, get a workout, hit a timer with verbal combo callouts, rate the difficulty, get a better next workout.

### Core loop

1. **Choose a level** at onboarding — Beginner / Intermediate / Advanced
2. **Tap "Get Fresh Workout"** on Home — Claude generates a unique workout in ~3 seconds
3. **Hit start** — round timer runs 3 min work / 1 min rest, voice calls combos out loud so you don't have to look at the screen
4. **Rate the workout** at the end — Too Easy / Just Right / Too Hard
5. **The AI adapts** — next workout gets harder, easier, or stays the same based on your rating + history

### What makes it different

- **Real boxing knowledge, not gym-influencer fluff.** Every combo is grounded in pro-fighter mechanics — slip-and-counter, catch-and-shoot, James Toney's absorb-and-rip, Usyk pivot-counter, Crawford stutter-step, Loma angle cuts. The AI is prompted with a comprehensive coaching framework: range awareness, eye discipline, breathing, setup-vs-commit punches, broken rhythm, hip loading.
- **9-tier progression** inside three levels — the user feels a real jump every time they level up. Beginners start with `1-2`, advanced users get `1-2-3b-2-5-6` with footwork transitions.
- **Voice-led, screen-optional.** Reads each combo aloud (jab, cross, lead hook to the body, rear uppercut). The phone goes in your pocket, your eyes stay forward. Picks the highest-quality male voice available on the device — Siri Voice 1 on iOS, Google's neural network TTS on Android.
- **Workout names that don't suck.** "Iron Foundation: Pivot Patrol" beats "Beginner Boxing Workout #47."
- **No paywalls. Free forever.** Monetized via small banner ads + interstitials between workouts. No subscription, no premium tier, no "unlock advanced techniques."

---

## Audience

- **Primary:** Solo home/garage boxers, 18–45, who own a bag or shadow-box, can't justify a coach
- **Secondary:** Boxing gym dropouts, fitness enthusiasts seeking cardio variety, fight-prep amateurs wanting between-session work
- **Not a fit for:** Fighters with active coaches, total beginners who don't know what a jab is (the app assumes basic terminology)

---

## Features (user-facing)

- AI-generated workouts personalized by level + recent feedback + total workout history
- Verbal combo callouts via on-device speech ("jab, cross, lead hook to the body")
- Round timer (3 min work / 1 min rest) with audio beeps for the last 5 seconds of each round
- Voice picker that auto-selects the highest-quality male voice installed; onboarding tip recommends a premium voice install path tailored to the user's OS (Apple Nathan on iOS, Google neural voices on Android, with a one-tap deep link to the right Settings pane)
- Streak tracking (current + longest) — daily 9 AM reminder to keep the streak alive (cross-platform DAILY trigger, no scheduling errors on either OS)
- Post-workout difficulty rating feeds the next AI generation
- Background audio — workout coaching continues with the screen locked
- Anonymous-first usage — no signup required. Optional account upgrade later that preserves all progress (UID is retained across the anon→email upgrade)
- Full account deletion — server-side Edge Function purges all user data tables AND the auth record (App Store 5.1.1(v) and Play Data Safety compliant)

---

## Tech stack (current)

- **Mobile:** Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9 strict
- **Navigation:** `@react-navigation/native-stack` + `bottom-tabs`
- **Styling:** NativeWind v4 + Tailwind v3
- **State:** Zustand with AsyncStorage persistence
- **Speech / audio / haptics:** `expo-speech`, `expo-av`, `expo-haptics`
- **Notifications:** `expo-notifications` (cross-platform DAILY trigger for streak reminder)
- **Backend:** Supabase (shared multi-tenant project — all tables, functions, buckets prefixed `punchpal_` / `punchpal-`)
- **AI:** Claude Sonnet 4.6 via Supabase Edge Function — API key never enters the mobile bundle
- **Auth:** Supabase Anonymous Auth, optional email/password upgrade via `updateUser` (preserves UID + all guest progress)
- **Monetization:** Google AdMob (banner + interstitials) — separate iOS + Android ad units, both wired in. No RevenueCat, no paywalls.
- **Package manager:** Bun

---

## Brand identity

### Name
**PunchPal** — friendly + technical. Not "Boxing Fitness Pro Elite Plus."

### Voice & tone
- **Confident but not aggressive.** Boxing knowledge speaks for itself; no need for shouting.
- **Coach, not drill sergeant.** "Amazing work. How did that feel?" not "DROP AND GIVE ME 20."
- **Boxing-literate.** Uses real notation (1-2-3, slip-and-counter, check hook) without translating to civilian terms.
- **Anti-fluff.** No "transform your body" copy. No before/after photos. Just: "Get a fresh boxing workout in 3 seconds. Hit start. Improve."

### Visual identity

**Colors (from the app):**
| Role | Hex | Use |
|---|---|---|
| Pure Black | `#000000` | Backgrounds, dominant surface |
| Dark Background | `#0A0A0A` | Section separators |
| Card Background | `#1A1A1A` | Cards, modals |
| Card Border | `#2A2A2A` | Borders, dividers |
| Boxing Red | `#DC2626` | Primary CTAs, accents, active state |
| Dark Red | `#B91C1C` | Hover/pressed states |
| Accent Red | `#FF0000` | Critical alerts, REST banner |
| Boxing Gold | `#D4AF37` | Premium accents, difficulty labels |
| Light Gold | `#F4E5C2` | Hover/highlight for gold elements |

**Typography:**
- App uses system fonts (San Francisco on iOS, Roboto on Android) at heavy weights — `font-black` and `font-bold` for most headlines, uppercase tracking-widest for eyebrows and labels.
- For the website, an athletic display font (similar weight to **Druk Wide**, **Anton**, or **Bebas Neue**) would echo the app's heavy-headline feel. Body in a clean sans (Inter, SF Pro, or system).

**Imagery:**
- Dark, high-contrast photography — boxers shadow-boxing, heavy bag work, slow-mo punches with motion blur
- Avoid: smiling group fitness photos, gym selfies, stock fitness model imagery, oversaturated colors
- Embrace: black/red/gold palette, deep shadows, single light sources, sweat, focus

### Logo
- Located at `mobile/icon.png` and `mobile/assets/logo.png` — stylized boxing glove on black with gold detail
- Should appear in the website hero / nav
- Android adaptive icon: same artwork, black background; the Play Store adaptive icon ships from the same source

---

## Store listing copy (drop-in for App Store + Play Console)

### Short description (≤80 chars — Play Store, App Store subtitle)

> AI boxing coach. Personalized workouts, voice cues, 9 progression tiers.

### Long description (≤4000 chars — Play Store, App Store description)

> PunchPal turns shadow-boxing into structured training. Tap one button and get a fresh boxing workout generated by AI in seconds — combos that match your level, voice cues that read each combo out loud, a round timer that runs itself.
>
> Built for solo boxers who don't have a coach. Real boxing technique, no fitness-influencer fluff.
>
> **What you get**
> • AI-generated workouts personalized to your level and recent feedback
> • Voice coach that calls out combos so you can keep your eyes forward
> • 9 progression tiers across Beginner / Intermediate / Advanced
> • Round timer with audio beeps for the final 5 seconds
> • Daily streak tracking with friendly reminders
> • Real boxing technique — slip-and-counter, check hook, body shots, footwork, broken rhythm
> • Workout names that don't suck (no more "Beginner Workout #47")
> • Anonymous-first — start training immediately, no signup needed
> • Optional account to sync progress across devices
>
> **No subscription. No paywalls. Free forever.** PunchPal stays free by showing a small banner and the occasional ad between workouts. That's it.
>
> Made for boxers who shadow-box, hit a bag, or train in their garage. Not a coaching replacement — a coaching companion when no human coach is around.

### Keywords (ASO — comma-separated, no spaces between commas)
> boxing,boxing workout,shadow boxing,heavy bag,boxing coach,combos,boxing trainer,boxing app,boxing technique,fight training

---

## Marketing website requirements (FOR LOVABLE)

Build a one-page (or short multi-page) marketing site for PunchPal. The goal is store conversion — visitors should leave with the app installed on whichever phone they're on.

### Required pages / sections

1. **Hero** — App name, tagline ("AI boxing coach in your pocket"), **both** App Store and Google Play download badges (detect platform if possible and surface the matching badge first), hero image (boxer with phone, OR product screenshot)
2. **Demo / screenshots** — 3–5 in-app screenshots (Home, Timer mid-round, post-workout rating modal, Profile). I will provide these — for now, use placeholder slots labeled with what each shows.
3. **Features section** — 4–6 cards covering: AI personalization, verbal callouts, 9-tier progression, streak tracking, real boxing technique, free forever
4. **How it works** — 3-step illustration of the core loop above
5. **About / Why PunchPal** — short paragraph addressing the problem (solo training without structure) and the solution
6. **Footer** — Support email link, Privacy Policy link, Terms link, both store badges again, social handles (placeholders for now)

### Required functional pages

- `/privacy` — privacy policy (use a generic AdMob + Supabase boilerplate as a starting point; declare data collected per AdMob SDK + workout logging)
- `/terms` — terms of service (boilerplate is fine for v1)
- `/support` — contact form or `mailto:` link

### CRITICAL — AdMob compliance file

**This is non-negotiable.** AdMob throttles ad fill rate until this file is published. Same file unlocks both iOS and Android.

- Create a file served at the EXACT path: `https://<the-site-domain>/app-ads.txt`
- Must be plain text (`Content-Type: text/plain`), no extension other than `.txt`, no HTML wrapping
- File must be at the literal root — NOT `/public/app-ads.txt`, NOT `/static/app-ads.txt` (those are source paths; the served URL must be root)
- HTTPS-served, no auth required, no redirect to `www` or another domain
- The file MUST contain exactly this single line, no extra whitespace, no BOM:

```
google.com, pub-8632074296834726, DIRECT, f08c47fec0942fa0
```

After deployment, verify via:
```
curl -sI https://<domain>/app-ads.txt    # expect 200 + Content-Type: text/plain
curl -s  https://<domain>/app-ads.txt    # expect exactly the one line above
```

The domain must match the marketing URLs listed in both App Store Connect AND Google Play Console exactly.

### Tech preferences for the website

- Static / fast — Vite + React or similar
- Mobile-first responsive
- Dark theme matching the app palette above
- Minimal JS — this is a marketing site, not an app

---

## App architecture (for reference, not for the website)

### File structure

```
mobile/
├── src/
│   ├── api/
│   │   ├── workout-generator.ts    # Calls Supabase Edge Function for AI workouts
│   │   ├── database-service.ts     # Supabase queries (user stats, sessions)
│   │   └── user-service.ts         # Anon auth + initialization
│   ├── components/
│   │   ├── WorkoutCard.tsx
│   │   ├── StreakCard.tsx
│   │   ├── PulsingEnergyLoader.tsx
│   │   └── BannerAdView.tsx        # AdMob banner wrapper (cross-platform)
│   ├── lib/
│   │   ├── supabaseClient.ts       # AsyncStorage-backed auth, autoRefresh
│   │   ├── tables.ts               # TABLES constant — punchpal_ prefixed
│   │   ├── ads.ts                  # AdMob config (separate iOS + Android unit IDs)
│   │   └── auth-helpers.ts
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── AuthScreen.tsx          # Optional sign-up (opens from Profile)
│   │   ├── OnboardingScreen.tsx    # Platform-aware voice tip step
│   │   ├── HomeScreen.tsx
│   │   ├── TimerScreen.tsx         # Platform-aware coach voice picker
│   │   └── ProfileScreen.tsx       # Invokes delete-account Edge Function
│   ├── state/
│   │   └── userStore.ts            # Zustand persisted store
│   ├── types/
│   │   └── workout.ts
│   └── utils/
│       ├── achievements.ts         # Tracked silently in store; no UI surface
│       └── notifications.ts        # Cross-platform DAILY trigger
├── supabase/
│   ├── functions/
│   │   ├── punchpal-generate-workout/index.ts   # Claude-powered workout EF
│   │   └── punchpal-delete-account/index.ts     # Service-role full-purge EF
│   └── migrations/
├── app.json                        # Both iOS + Android config
└── eas.json                        # Build + submit profiles for both platforms
```

### Supabase tables (all prefixed `punchpal_`)

- `punchpal_user_stats` — per-user aggregate (total workouts, streak, level, accuracy)
- `punchpal_workout_sessions` — every completed session, optional difficulty rating
- `punchpal_combo_progress` — schema exists; not currently written from mobile

RLS enabled on all tables, scoped by `user_id = auth.uid()::text`. Deletes funnel through the `punchpal-delete-account` Edge Function (service-role key bypasses RLS to purge data tables AND the auth row in one call).

### Edge Functions

- **`punchpal-generate-workout`** — Deno runtime, takes user's level + history + recent ratings → returns a JSON workout (name, duration, rounds, combos[]). Uses Claude Sonnet 4.6 with `output_config.json_schema` to guarantee shape. Server reconciles `combos.length === rounds`.
- **`punchpal-delete-account`** — Deno runtime. Validates the caller's JWT, then uses `SUPABASE_SERVICE_ROLE_KEY` to delete all PunchPal data tables AND call `auth.admin.deleteUser()`. Returns `{data_deleted, auth_deleted, ...errors}` so the client can show a graceful message if the shared-project FK constraints block the auth-row deletion.

### AdMob configuration

- App IDs and ad unit IDs for both iOS and Android are baked into `mobile/app.json` plugin block and `mobile/src/lib/ads.ts`
- Auto-switches between Google test IDs (dev builds via `__DEV__`) and real publisher IDs (production builds for both stores)
- Non-personalized ads only — no App Tracking Transparency prompt
- 30-second frequency cap shared across all interstitials
- Placements: bottom-of-Home banner; interstitial before workout generation; interstitial after workout completion
- `FORCE_TEST_ADS` toggle in `mobile/src/lib/ads.ts` for safe-testing production builds before store submission

### Cross-platform notes

- **Voice picker** branches by `Platform.OS` — iOS prefers Siri Voice 1 then named premium voices (Nathan, Aaron, Evan…); Android prefers Google TTS `*-network` neural voices, then Enhanced local, then any en-US.
- **Speech rate** — 0.95 on iOS, 0.88 on Android (Android TTS sounds less robotic when slowed slightly).
- **Onboarding voice tip** — iOS guides the user to download Nathan via Accessibility → Spoken Content; Android guides them to install Google's Voice II/IV via Languages & input → Text-to-speech output, with a direct deep link via `Linking.sendIntent("com.android.settings.TTS_SETTINGS")`. The step auto-skips if a high-quality voice is already installed and re-detects when the user returns from Settings.
- **Notifications** — daily reminder uses `SchedulableTriggerInputTypes.DAILY` (not CALENDAR — the latter is iOS-only and throws on Android).
- **KeyboardAvoidingView** on AuthScreen uses `behavior="padding"` on iOS, `"height"` on Android.

---

## Environment

```
EXPO_PUBLIC_SUPABASE_URL=<shared supabase project url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon jwt>
```

`ANTHROPIC_API_KEY` is set as a Supabase Edge Function secret, never enters the mobile bundle.

### Local dev (requires an EAS dev build — Expo Go no longer supported due to native ad SDK)

iOS:
```
cd mobile
eas build --profile development --platform ios
# install resulting build on iPhone via TestFlight or QR
npx expo start --dev-client --clear
```

Android:
```
cd mobile
eas build --profile development --platform android
# install the APK on Android via the link EAS prints
npx expo start --dev-client --clear
```

### Production builds

```
# iOS → App Store (auto-submits via App Store Connect)
eas build --profile production --platform ios --auto-submit

# Android → Play Store Internal Testing (auto-submits via Play API service account)
eas build --profile production --platform android --auto-submit
```

Android auto-submit requires `mobile/play-service-account.json` (gitignored — see Google Cloud service account setup in `~/.claude/plans/`). First-ever Play Store release for a new app must be uploaded manually via Play Console UI; subsequent releases work via API.
