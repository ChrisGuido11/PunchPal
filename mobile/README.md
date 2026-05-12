# PunchPal — AI Boxing Coach

An iOS app that generates personalized boxing workouts on demand, powered by Claude Sonnet 4.6. Built for solo boxers who want a coach in their pocket — without the cost of a real one.

**Live on the App Store.** Bundle ID: `com.punchpal.app`

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
- **Voice-led, screen-optional.** Expo Speech reads each combo aloud (jab, cross, lead hook to the body, rear uppercut). The phone goes in your pocket, your eyes stay forward.
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
- Verbal combo callouts via on-device speech synthesis ("jab, cross, lead hook to the body")
- Round timer (3 min work / 1 min rest), beep at the last 5 seconds of each phase
- Streak tracking (current + longest) — daily reminders to keep the streak alive
- Achievements (13 total — first workout, week warrior, century club, ring legend, etc.)
- Post-workout difficulty rating feeds the next AI generation
- Anonymous-first usage — no signup required. Optional account upgrade later that preserves all progress.
- iOS background audio — workout keeps coaching even when the screen locks

---

## Tech stack (current)

- **Mobile:** Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9 strict
- **Language:** TypeScript
- **Navigation:** `@react-navigation/native-stack` + `bottom-tabs`
- **Styling:** NativeWind v4 + Tailwind v3
- **State:** Zustand with AsyncStorage persistence
- **Speech / audio:** `expo-speech`, `expo-av`, `expo-haptics`
- **Backend:** Supabase (shared multi-tenant project, all tables prefixed `punchpal_`)
- **AI:** Claude Sonnet 4.6 via Supabase Edge Function (`punchpal-generate-workout`) — API key never enters the mobile bundle
- **Auth:** Supabase Anonymous Auth (upgradeable to email/password via Profile)
- **Monetization:** Google AdMob (banner + interstitials) — no RevenueCat, no paywalls
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
| Boxing Gold | `#D4AF37` | Achievements, premium accents, difficulty labels |
| Light Gold | `#F4E5C2` | Hover/highlight for gold elements |

**Typography:**
- App uses system fonts (San Francisco on iOS) at heavy weights — `font-black` and `font-bold` for most headlines, uppercase tracking-widest for eyebrows and labels.
- For the website, an athletic display font (similar weight to **Druk Wide**, **Anton**, or **Bebas Neue**) would echo the app's heavy-headline feel. Body in a clean sans (Inter, SF Pro, or system).

**Imagery:**
- Dark, high-contrast photography — boxers shadow-boxing, heavy bag work, slow-mo punches with motion blur
- Avoid: smiling group fitness photos, gym selfies, stock fitness model imagery, oversaturated colors
- Embrace: black/red/gold palette, deep shadows, single light sources, sweat, focus

### Logo
- Located at `mobile/icon.png` and `mobile/assets/logo.png` — a stylized boxing glove on black, gold detail
- Should appear in the website hero / nav

---

## Marketing website requirements (FOR LOVABLE)

Build a one-page (or short multi-page) marketing site for PunchPal. The goal is App Store conversion — visitors should leave with an installed app.

### Required pages / sections

1. **Hero** — App name, tagline ("AI boxing coach in your pocket"), App Store download badge, hero image (boxer with phone, OR product screenshot)
2. **Demo / screenshots** — 3–5 in-app screenshots (Home, Timer mid-round, post-workout rating, Profile achievements). I will provide these — for now, use placeholder slots labeled with what each shows.
3. **Features section** — 4–6 cards covering: AI personalization, verbal callouts, 9-tier progression, streak tracking, real boxing technique, free forever
4. **How it works** — 3-step illustration of the core loop above
5. **About / Why PunchPal** — short paragraph addressing the problem (solo training without structure) and the solution
6. **Footer** — Support email link, Privacy Policy link, Terms link, App Store badge again, social handles (placeholders for now)

### Required functional pages

- `/privacy` — privacy policy (use a generic AdMob + Supabase boilerplate as a starting point; I will replace with real copy)
- `/terms` — terms of service (boilerplate is fine for v1)
- `/support` — contact form or `mailto:` link

### CRITICAL — AdMob compliance file

**This is non-negotiable.** AdMob is currently throttling ad fill rate until this file is published.

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

The domain must match the "Marketing URL" listed in App Store Connect exactly (case, subdomain, trailing slash — AdMob's crawler is strict).

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
│   │   └── BannerAdView.tsx        # AdMob banner wrapper
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── tables.ts               # TABLES constant — punchpal_ prefixed
│   │   ├── ads.ts                  # AdMob config + useInterstitial hook
│   │   └── auth-helpers.ts
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── AuthScreen.tsx          # Optional sign-up (opens from Profile)
│   │   ├── OnboardingScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── TimerScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── state/
│   │   └── userStore.ts            # Zustand persisted store
│   ├── types/
│   │   └── workout.ts
│   └── utils/
│       ├── achievements.ts
│       └── notifications.ts
├── supabase/
│   ├── functions/
│   │   └── punchpal-generate-workout/index.ts   # Claude-powered EF
│   └── migrations/
└── app.json
```

### Supabase tables (all prefixed `punchpal_`)

- `punchpal_user_stats` — per-user aggregate (total workouts, streak, level, accuracy)
- `punchpal_workout_sessions` — every completed session with optional difficulty rating
- `punchpal_combo_progress` — schema exists, not currently written from mobile

RLS enabled on all tables, scoped by `user_id = auth.uid()::text`.

### Edge Function

`punchpal-generate-workout` runs on Supabase Edge Runtime (Deno). Takes user's level + history + recent ratings → returns a JSON workout (name, duration, rounds, combos[]). Uses Claude Sonnet 4.6 with `output_config.json_schema` to guarantee shape. Server reconciles `combos.length === rounds`.

### AdMob configuration

- iOS App ID and Android App ID are baked into `mobile/app.json` plugin block
- Ad unit IDs in `mobile/src/lib/ads.ts` — switch automatically between Google test IDs (dev builds) and real publisher IDs (TestFlight + App Store) via `__DEV__`
- Non-personalized ads only — no App Tracking Transparency prompt
- 30-second frequency cap shared across all interstitials
- Placements: bottom-of-Home banner; interstitial before workout generation; interstitial after workout completion

---

## Environment

```
EXPO_PUBLIC_SUPABASE_URL=<shared supabase project url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon jwt>
```

`ANTHROPIC_API_KEY` is set as a Supabase Edge Function secret, never enters the mobile bundle.

### Local dev (requires EAS dev build — Expo Go no longer supported)

```
cd mobile
eas build --profile development --platform ios
# install resulting build on iPhone via TestFlight or QR
npx expo start --dev-client --clear
```
