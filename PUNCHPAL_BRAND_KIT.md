# PunchPal — Master Brand & Listing Document

**Last updated:** 2026-05-17
**App version:** 1.1.0 (iOS build 2 / Android versionCode 1)
**Platforms:** iOS (live on the App Store) + Android (shipping to Google Play)
**Bundle ID / Package:** `com.punchpal.app`
**Primary contact:** chris@stratega.io

This is the canonical source for everything PunchPal — the app's identity, what it does, who it's for, store listings, ad copy, screenshots brief, press kit, FAQ, and the technical facts marketers/reviewers/publishers will ask about. Copy from this file into the App Store, Play Console, the marketing website, press emails, influencer briefs, and ad creatives.

---

## 1. The 30-second pitch

**PunchPal is an AI boxing coach in your pocket.** Tap one button. In about three seconds, Claude Sonnet 4.6 generates a personalized boxing workout with real pro-fighter technique — slip-and-counter, check hook, body shots, footwork. A voice coach calls out every combo so you can keep your eyes forward. A round timer runs 3 min work / 1 min rest. At the end you rate it Too Easy / Just Right / Too Hard, and the next workout adapts. Free forever, no paywalls, ad-supported.

**One-liner:** AI boxing coach. Personalized workouts, voice cues, 9 progression tiers. Free.

**Tagline options:**
- "AI boxing coach in your pocket."
- "Tap. Get a workout. Hit start."
- "A fresh boxing workout in 3 seconds."
- "Shadow-box like you have a coach."
- "Real boxing technique, on demand."

---

## 2. The problem we solve

Solo boxers — people training at home, in their garage, with a heavy bag, or just shadow-boxing on a free afternoon — have two bad options today:

1. **Wing it.** Twenty minutes of unstructured shadow-boxing that drifts into the same three combos you always throw.
2. **Pay for a coach.** $80–$150/hr for in-person training, which most people can't justify for a hobby.

YouTube workout videos are static — you do "Workout #47" twice and you've memorized it. Generic fitness apps don't speak boxing; they prescribe "30 jab-crosses, 30 seconds rest" with no technique grounding, no progression curve, no adaptation.

**PunchPal fixes it by treating every session as a custom-generated coaching session.** Tell it your level once. Tap the button. The AI writes you a workout grounded in actual pro-fighter mechanics, hands you a voice coach for the duration, and adapts the next one based on how the last one felt.

---

## 3. Audience

### Primary
- **Solo home / garage boxers**, 18–45
- Owns a heavy bag, double-end bag, or just floor space to shadow-box
- Trains 1–4 times a week
- Already understands basic terminology (jab, cross, hook, slip)
- Can't or won't pay for a coach
- Wants structure without being stuck on a $50/mo subscription

### Secondary
- **Boxing gym dropouts** who can't get to class anymore but want to keep training
- **Fitness enthusiasts** who already lift / run and want cardio variety
- **Fight-prep amateurs** wanting extra work between coach-led sessions
- **Sparring partners and training partners** who run their own gym sessions and need fresh rotations

### Not a fit
- Fighters with active in-person coaches (this isn't a replacement)
- People who don't know what a jab is — the app assumes basic boxing literacy and doesn't explain "this is your left hand"
- Pure cardio / kickboxing-fitness audiences (no kicks, no choreographed group-fitness vibe)

---

## 4. Core user flow

1. **Pick a level** at onboarding — Beginner / Intermediate / Advanced
2. **Optional voice tip** — if a high-quality male voice isn't installed, onboarding shows a platform-aware tip with a one-tap deep link into the right Settings pane (Accessibility → Spoken Content on iOS; Languages & Input → Text-to-Speech on Android)
3. **Tap "Get Fresh Workout"** on Home — Claude generates a unique workout in ~3 seconds
4. **Hit start** — round timer runs 3 min work / 1 min rest with audio beeps for the last 5 seconds of every round; voice calls each combo out loud
5. **Rate the workout** at the end — Too Easy / Just Right / Too Hard
6. **The AI adapts** — next workout gets harder, easier, or holds based on your rating + history; streak updates; daily 9 AM reminder fires the next day to keep the streak alive

The phone goes in your pocket. Your eyes stay forward.

---

## 5. Full feature list (user-facing)

### Workout engine
- **AI-generated workouts** personalized by level + recent difficulty ratings + total workout history
- **9-tier progression** inside the three skill levels — each tier feels like a real jump
  - Beginner tiers start with `1-2`, basic footwork, range awareness
  - Intermediate tiers introduce slip-and-counter, body shots, broken rhythm, hooks-to-the-body
  - Advanced tiers chain combos like `1-2-3b-2-5-6` with pivot-counters, James Toney absorb-and-rip, Usyk pivot-counter, Crawford stutter-step, Loma angle cuts
- **Workout names that don't suck** — "Iron Foundation: Pivot Patrol" instead of "Beginner Boxing Workout #47"
- **Real boxing technique** grounded in pro-fighter mechanics, not gym-influencer fluff
- **Coaching framework** baked into the AI prompt: range awareness, eye discipline, breathing, setup-vs-commit punches, broken rhythm, hip loading

### In-workout experience
- **Round timer** — 3 min work / 1 min rest, fully automated
- **Audio beeps** for the last 5 seconds of each round
- **Verbal combo callouts** via on-device TTS — "jab, cross, lead hook to the body, rear uppercut"
- **Voice picker** auto-selects the highest-quality male voice installed
  - iOS: Siri Voice 1 first, then named premium voices (Nathan, Aaron, Evan, Tom, Reed)
  - Android: Google TTS `*-network` neural voices first, then Enhanced local, then any en-US fallback
- **Platform-tuned speech rate** — 0.95 on iOS, 0.88 on Android (Android TTS sounds less robotic when slowed slightly)
- **Background audio** — workout coaching continues with the screen locked, in your pocket, or while another app is foregrounded
- **Haptic feedback** on key transitions (round start, rest, workout complete)

### Progression & retention
- **Streak tracking** — current streak + longest streak
- **Daily 9 AM reminder** notification to keep the streak alive (cross-platform DAILY trigger, no scheduling errors on either OS)
- **Post-workout difficulty rating** (Too Easy / Just Right / Too Hard) directly feeds the next AI generation
- **Silent achievement tracking** (no UI surface yet — future feature)

### Account & data
- **Anonymous-first** — start training immediately, no signup needed
- **Optional account upgrade** — email/password sign-up later that preserves all progress (UID retained across the anon→email upgrade)
- **Full account deletion** — server-side Edge Function purges all user data tables AND the auth record in one call (App Store 5.1.1(v) and Play Data Safety compliant)

### Monetization (and what we DON'T do)
- **Free forever** — no subscription, no premium tier, no "unlock advanced techniques"
- **Small banner** on Home screen
- **Interstitial** before workout generation and after workout completion (frequency-capped to 30 seconds shared across all interstitials)
- **Non-personalized ads only** — no App Tracking Transparency prompt
- **No paywalls anywhere in the app**

---

## 6. What makes PunchPal different

| Generic boxing app | PunchPal |
|---|---|
| Pre-recorded video workouts | AI-generated workout every session |
| Same 10 routines on a loop | Infinite variety, fresh every tap |
| "30 jabs, 30 seconds rest" | Real combos with slip-and-counter, pivots, body work |
| Fitness-influencer cues | Pro-fighter coaching framework |
| Eyes glued to a screen | Voice-led, screen-optional |
| $9.99/mo subscription paywall | Free forever, ad-supported |
| Generic "Workout #47" names | "Iron Foundation: Pivot Patrol" |
| Static difficulty | Adapts to your last rating |

---

## 7. Brand identity

### Name
**PunchPal** — friendly + technical. Not "Boxing Fitness Pro Elite Plus."

### Voice & tone
- **Confident but not aggressive.** Boxing knowledge speaks for itself; no shouting required.
- **Coach, not drill sergeant.** "Amazing work. How did that feel?" beats "DROP AND GIVE ME 20."
- **Boxing-literate.** Uses real notation (1-2-3, slip-and-counter, check hook) without translating to civilian terms.
- **Anti-fluff.** No "transform your body" copy. No before/after photos. Just: "Get a fresh boxing workout in 3 seconds. Hit start. Improve."

### Visual identity — color palette
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

### Typography
- **In-app:** system fonts (San Francisco on iOS, Roboto on Android) at heavy weights — `font-black` and `font-bold` for most headlines, uppercase + tracking-widest for eyebrows and labels.
- **For website / marketing:** an athletic display font (Druk Wide, Anton, or Bebas Neue) for headlines; clean sans (Inter, SF Pro, or system) for body.

### Imagery direction
- **Embrace:** black/red/gold palette, deep shadows, single light source, sweat, focus, slow-mo punches with motion blur, heavy-bag work, dim garage gyms, raw shadow-boxing
- **Avoid:** smiling group fitness, gym selfies, stock fitness model imagery, oversaturated brand-y colors, pastel anything

### Logo
- Located at `mobile/icon.png` and `mobile/assets/logo.png`
- Stylized boxing glove on black with gold detail
- Android adaptive icon ships the same artwork on a `#000000` background
- Use the logo full-bleed on dark; never on light backgrounds without a dark plate behind it

---

## 8. Store listing copy

### App Store / Play Store **app name**
> PunchPal

### App Store **subtitle** / Play Store **short description** (≤80 chars)
> AI boxing coach. Personalized workouts, voice cues, 9 progression tiers.

### Alternate subtitle options (≤30 chars where needed)
- "AI boxing coach in your pocket"
- "Fresh boxing workouts on tap"
- "Your AI shadow-boxing coach"
- "Tap. Get a workout. Hit start."

### Long description (≤4000 chars — works for both stores)

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
> • Background audio — phone in pocket, eyes forward, screen off
> • Anonymous-first — start training immediately, no signup needed
> • Optional account to sync progress across devices
>
> **No subscription. No paywalls. Free forever.** PunchPal stays free by showing a small banner and the occasional ad between workouts. That's it.
>
> Made for boxers who shadow-box, hit a bag, or train in their garage. Not a coaching replacement — a coaching companion when no human coach is around.

### ASO keywords (comma-separated, no spaces between commas)
> boxing,boxing workout,shadow boxing,heavy bag,boxing coach,combos,boxing trainer,boxing app,boxing technique,fight training

### Promotional text (App Store ≤170 chars — refreshable without resubmission)
> A fresh, personalized boxing workout in 3 seconds. Voice cues call every combo. Round timer runs itself. Free forever. Tap. Train.

### What's New (release notes — version 1.1.0)
> • Cross-platform daily streak reminders now work flawlessly on Android
> • Smarter voice picker with Google neural TTS support on Android
> • Reduced robotic delivery on Android — pace and pitch tuned for clarity
> • Onboarding now detects your best installed voice and skips the tip if you're already set up
> • Bug fixes and stability improvements

### Categories
- **Primary:** Health & Fitness
- **Secondary:** Sports

### Age rating
- 4+ (no objectionable content; coaching language is technical, not explicit)

### Pricing
- Free with ads

---

## 9. Marketing website requirements

**Goal:** store conversion. Visitor → app installed on whichever phone they're on.

### Sections (single-page or short multi-page)

1. **Hero**
   - App name + tagline ("AI boxing coach in your pocket")
   - **Both** App Store and Google Play download badges (detect platform if possible and surface the matching badge first)
   - Hero image — boxer with phone, OR a product screenshot of the Home screen
2. **Demo / screenshots** — 3–5 in-app screenshots (Home, Timer mid-round, post-workout rating modal, Profile)
3. **Features section** — 4–6 cards: AI personalization, verbal callouts, 9-tier progression, streak tracking, real boxing technique, free forever
4. **How it works** — 3-step illustration of the core loop (Pick level → Tap button → Hit start)
5. **About / Why PunchPal** — short paragraph: the problem (solo training without structure) → the solution
6. **Footer** — Support email, Privacy Policy link, Terms link, both store badges again, social handles (placeholders)

### Required functional pages
- `/privacy` — privacy policy (AdMob + Supabase boilerplate as starting point; declare data collected per AdMob SDK + workout logging)
- `/terms` — terms of service (boilerplate fine for v1)
- `/support` — contact form or `mailto:` link to `chris@stratega.io`

### Tech preferences
- Static / fast — Vite + React or similar
- Mobile-first responsive
- Dark theme matching the app palette
- Minimal JS — marketing site, not an app

---

## 10. CRITICAL — AdMob `app-ads.txt` compliance

**This is non-negotiable.** AdMob throttles ad fill rate until this file is published. Same file unlocks both iOS and Android.

- Create a file served at the **exact** path: `https://<the-site-domain>/app-ads.txt`
- Must be **plain text** (`Content-Type: text/plain`), no extension other than `.txt`, no HTML wrapping
- File must be at the **literal root** — NOT `/public/app-ads.txt`, NOT `/static/app-ads.txt` (those are source paths; the served URL must be root)
- HTTPS-served, no auth required, no redirect to `www` or another domain
- The file MUST contain **exactly** this single line, no extra whitespace, no BOM:

```
google.com, pub-8632074296834726, DIRECT, f08c47fec0942fa0
```

After deployment, verify:
```
curl -sI https://<domain>/app-ads.txt    # expect 200 + Content-Type: text/plain
curl -s  https://<domain>/app-ads.txt    # expect exactly the one line above
```

The domain must match the marketing URLs listed in both App Store Connect AND Google Play Console exactly.

---

## 11. Screenshots brief (for store + website)

Need 5 screenshots per platform (iPhone 6.7" and Android phone). Order matters — first three are what 90% of viewers see.

1. **Home with Workout Card visible** — "Iron Foundation: Pivot Patrol" or similar, with the big red "Start Workout" CTA. Overlay headline: *"Tap. Get a fresh workout in 3 seconds."*
2. **Timer mid-round** — "Round 2 of 6", current combo "1-2-3b-2", time remaining 1:47, big red ring. Overlay: *"Voice coach calls every combo. Eyes stay forward."*
3. **Post-workout rating modal** — Too Easy / Just Right / Too Hard buttons. Overlay: *"Rate it. The next workout adapts."*
4. **Streak card on Home** — Current streak 12 / Longest 18. Overlay: *"Daily reminders keep your streak alive."*
5. **Profile / level selection** — Beginner / Intermediate / Advanced with current tier highlighted. Overlay: *"9 progression tiers. Real jumps every time you level up."*

Optional 6th: Onboarding voice-tip step on Android with "Open Settings" CTA. Overlay: *"Picks the best voice on your phone."*

---

## 12. Press / outreach kit

### Boilerplate (drop into press emails, podcast pitches, influencer outreach)

> **PunchPal** is an AI-powered boxing coach for solo trainers. Built by a Los Angeles boxing hobbyist who couldn't justify a $100/hr coach for garage workouts, PunchPal uses Claude Sonnet 4.6 to generate personalized boxing workouts in about three seconds. A voice coach calls each combo aloud, a round timer runs itself, and the AI adapts based on how the user rated their last session. Real pro-fighter technique — slip-and-counter, check hook, body shots, footwork — not fitness-influencer fluff. Free forever, no paywalls, available on iOS (App Store) and Android (Google Play).

### Founder quote
> "Every boxing app I tried wanted $9.99 a month to show me the same ten workouts on a loop. I wanted a coach in my pocket — something that knew real boxing, generated fresh work every time, and got out of my way once I tapped start. So I built it."
> — Chris Guida, creator of PunchPal

### Story angles
- **The post-pandemic garage-gym boom meets generative AI** — solo training was the only training for two years, and AI-generated coaching is the natural next step
- **Free forever in an app store dominated by $9.99 subscriptions** — PunchPal monetizes via small ads instead of paywalling progression
- **Why boxing technique matters even in a "fitness" app** — anti-fluff stance; the AI is grounded in pro-fighter mechanics, not "boxing-inspired cardio"
- **Voice-first UX for a screen-burdened world** — workout coaching that lets you put the phone in your pocket
- **Solo-developer building with Claude** — built on Expo, React Native, Supabase Edge Functions, Claude Sonnet 4.6; shipped to both stores by one person

### Contact
- **Founder:** Chris Guida — chris@stratega.io
- **Location:** West LA / Santa Monica
- **Parent brand:** Stratega (AI automation for local businesses) — PunchPal is a consumer side-project

---

## 13. Sample ad creatives & copy

### Performance ad headlines (Meta / TikTok / Google UAC)
- "AI boxing coach. Free."
- "Tap. Get a workout. Hit start."
- "Stop shadow-boxing the same 3 combos."
- "A fresh boxing workout in 3 seconds."
- "Boxing technique, not fitness fluff."
- "Eyes forward. Phone in pocket. Train."
- "What if your phone was your boxing coach?"

### Primary ad copy (Meta / TikTok body, 90 chars)
- "Personalized boxing workouts generated by AI. Voice calls every combo. Free forever."
- "Solo boxer? Stop winging it. Tap one button — fresh workout, voice cues, round timer."
- "9 tiers of real boxing progression. AI adapts every session. No subscription. Ever."

### TikTok / Reels hooks (first 2 seconds)
- "POV: your coach is in your pocket and never gets tired"
- "I built an AI boxing coach because I'm cheap"
- "This app reads my boxing combos out loud while I'm hitting the bag"
- "Why I quit my $120/hr boxing coach for an app I built"

### CTA variants
- "Get the app — free"
- "Train tonight"
- "Download — free forever"
- "Start your streak"

---

## 14. FAQ (for support page, App Store reviewer notes, marketing)

**Is PunchPal really free?**
Yes. Free forever, no subscription, no premium tier. We show a small banner on the Home screen and an ad between workouts. That's the whole monetization.

**Do I need a heavy bag?**
No. PunchPal works for shadow-boxing, heavy bag, double-end bag, or any solo training. The combos translate.

**Do I need a coach already?**
No, but you should know basic boxing terms (jab, cross, hook, slip). The app assumes you know what a "1-2" is — it won't teach you stance from scratch. If you're brand-new, watch one YouTube boxing-basics video first, then come back.

**Does it work offline?**
Workout generation needs an internet connection (the AI runs on the server). Once a workout is loaded, the round timer and voice cues work offline.

**What languages does the voice coach support?**
English only at launch. The voice picker auto-selects the best male English voice installed on your phone.

**Will it sync between my iPhone and Android?**
Yes if you create an optional account (email + password). Anonymous users are device-local.

**How do I get a better voice?**
On iPhone: Settings → Accessibility → Spoken Content → Voices → English → install a premium voice like Nathan.
On Android: Settings → Languages & Input → Text-to-Speech → Google → install a Voice II or IV.
The app's onboarding walks you through this with a one-tap deep link.

**Can I delete my account and data?**
Yes. Profile → Delete Account purges everything in one tap — both your data and your auth record. We're App Store 5.1.1(v) and Play Data Safety compliant.

**Why no Apple Watch?**
Not in v1. Possibly later if there's demand.

**Is this iOS or Android?**
Both. Same app, same features, same bundle ID.

---

## 15. Technical fact sheet

(For ad networks, reviewers, partnership emails — anyone who needs to know the underlying stack.)

### Platforms
- **iOS:** App Store (live)
- **Android:** Google Play Store (shipping)
- **Bundle ID / package:** `com.punchpal.app` (identical on both)
- **Minimum OS:** iOS 15+, Android 7+

### Tech stack
- **Mobile:** Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9 strict
- **Navigation:** `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- **Styling:** NativeWind v4 + Tailwind v3 (dark theme only)
- **State:** Zustand with AsyncStorage persistence
- **Speech / audio / haptics:** `expo-speech`, `expo-av`, `expo-haptics`
- **Notifications:** `expo-notifications` (cross-platform DAILY trigger)
- **Backend:** Supabase (shared multi-tenant project — all tables, functions, buckets prefixed `punchpal_` / `punchpal-`)
- **AI:** Claude Sonnet 4.6 via Supabase Edge Function — API key never enters the mobile bundle
- **Auth:** Supabase Anonymous Auth, optional email/password upgrade via `updateUser` (preserves UID + all guest progress)
- **Monetization:** Google AdMob (banner + interstitials), separate iOS + Android ad units, both wired in. No RevenueCat, no paywalls.
- **Package manager:** Bun

### AdMob configuration
- **Publisher ID:** `pub-8632074296834726`
- **iOS App ID:** `ca-app-pub-8632074296834726~5383909951`
- **Android App ID:** `ca-app-pub-8632074296834726~2040607495`
- **Android Banner ID:** `ca-app-pub-8632074296834726/9712425409`
- **Android Interstitial ID:** `ca-app-pub-8632074296834726/6960927537`
- iOS banner + interstitial IDs are wired separately in `mobile/src/lib/ads.ts`
- Auto-switches to Google test IDs in `__DEV__` builds, real IDs in production
- Non-personalized ads only, no ATT prompt
- 30-second frequency cap shared across all interstitials
- Placements: bottom-of-Home banner; interstitial before workout generation; interstitial after workout completion

### Data collected (Privacy nutrition labels / Play Data Safety)
- **Workout sessions** (duration, level, combos, optional difficulty rating) — tied to anonymous user ID
- **User stats** (total workouts, streak, level)
- **Email** — only if user opts into account upgrade
- **AdMob device identifiers** — per AdMob SDK requirements, non-personalized
- **No location, no photos, no contacts, no microphone, no health data**

### Compliance
- **App Store 5.1.1(v)** — account deletion supported in-app
- **Play Data Safety** — full data deletion in-app
- **GDPR / CCPA** — handled via the same delete flow + non-personalized ad serving
- **iOS encryption export** — `ITSAppUsesNonExemptEncryption: false` (no custom crypto)
- **iPhone-only** (`supportsTablet: false`) — by design

### File structure
```
mobile/
├── src/
│   ├── api/
│   │   ├── workout-generator.ts     # Calls Supabase Edge Function for AI workouts
│   │   ├── database-service.ts      # Supabase queries (user stats, sessions)
│   │   └── user-service.ts          # Anon auth + initialization
│   ├── components/
│   │   ├── WorkoutCard.tsx
│   │   ├── StreakCard.tsx
│   │   ├── PulsingEnergyLoader.tsx
│   │   └── BannerAdView.tsx         # AdMob banner wrapper (cross-platform)
│   ├── lib/
│   │   ├── supabaseClient.ts        # AsyncStorage-backed auth, autoRefresh
│   │   ├── tables.ts                # TABLES constant — punchpal_ prefixed
│   │   ├── ads.ts                   # AdMob config (separate iOS + Android unit IDs)
│   │   └── auth-helpers.ts
│   ├── navigation/RootNavigator.tsx
│   ├── screens/
│   │   ├── SplashScreen.tsx
│   │   ├── AuthScreen.tsx           # Optional sign-up (opens from Profile)
│   │   ├── OnboardingScreen.tsx     # Platform-aware voice tip step
│   │   ├── HomeScreen.tsx
│   │   ├── TimerScreen.tsx          # Platform-aware coach voice picker
│   │   └── ProfileScreen.tsx        # Invokes delete-account Edge Function
│   ├── state/userStore.ts           # Zustand persisted store
│   ├── types/workout.ts
│   └── utils/
│       ├── achievements.ts          # Tracked silently in store; no UI surface
│       └── notifications.ts         # Cross-platform DAILY trigger
├── supabase/
│   ├── functions/
│   │   ├── punchpal-generate-workout/index.ts   # Claude-powered workout EF
│   │   └── punchpal-delete-account/index.ts     # Service-role full-purge EF
│   └── migrations/
├── app.json
└── eas.json
```

### Supabase tables (all prefixed `punchpal_`)
- `punchpal_user_stats` — per-user aggregate (total workouts, streak, level, accuracy)
- `punchpal_workout_sessions` — every completed session, optional difficulty rating
- `punchpal_combo_progress` — schema exists; not currently written from mobile

RLS enabled on all tables, scoped by `user_id = auth.uid()::text`. Deletes funnel through the `punchpal-delete-account` Edge Function (service-role key bypasses RLS to purge data tables AND the auth row in one call).

### Edge functions
- **`punchpal-generate-workout`** — Deno runtime. Takes user's level + history + recent ratings → returns a JSON workout (name, duration, rounds, combos[]). Uses Claude Sonnet 4.6 with `output_config.json_schema` to guarantee shape. Server reconciles `combos.length === rounds`.
- **`punchpal-delete-account`** — Deno runtime. Validates caller's JWT, then uses `SUPABASE_SERVICE_ROLE_KEY` to delete all PunchPal data tables AND call `auth.admin.deleteUser()`. Returns `{data_deleted, auth_deleted, ...errors}` so the client shows a graceful message if shared-project FK constraints block the auth-row deletion.

### Cross-platform notes
- **Voice picker** branches on `Platform.OS` — iOS prefers Siri Voice 1 then named premium voices; Android prefers Google TTS `*-network`, then Enhanced local, then any en-US.
- **Speech rate** — 0.95 on iOS, 0.88 on Android.
- **Onboarding voice tip** — iOS deep-links to Accessibility → Spoken Content; Android deep-links to `com.android.settings.TTS_SETTINGS` via `Linking.sendIntent`. Step auto-skips when a high-quality voice is detected and re-detects when the user returns from Settings.
- **Notifications** — DAILY trigger (CALENDAR is iOS-only and throws on Android).
- **KeyboardAvoidingView** uses `behavior="padding"` on iOS, `"height"` on Android.

---

## 16. Roadmap (not for public marketing — internal reference)

### Shipped in v1.1.0
- Cross-platform Android parity (notifications, voice picker, TTS rate tuning)
- Android AdMob wiring
- Vibecode legacy native package cleanup
- DAILY trigger fix for Android streak reminders

### Near-term candidates
- Workout Library / favorites (screen exists, not enabled in tabs yet)
- Apple Watch companion (round timer + combo cues on the wrist)
- Combo progress UI (data layer already tracking)
- Localization (Spanish, Portuguese)

### Explicit non-goals
- Subscriptions / paywalls
- Video content
- Live-coach matching marketplace
- Kicks / MMA / kickboxing modes — PunchPal stays focused on boxing

---

## 17. Where things live

- **Repo:** `C:\Users\cguid\Downloads\PunchPal`
- **Mobile app:** `mobile/`
- **Edge functions:** `mobile/supabase/functions/`
- **AdMob runbook:** `ANDROID_ADMOB_SETUP.md`
- **Progress journal:** `PROGRESS.md`
- **This document:** `PUNCHPAL_BRAND_KIT.md`

For deeper engineering context, the canonical readme is `mobile/README.md` — it covers build commands, EAS profiles, environment variables, and the full developer-facing architecture.
