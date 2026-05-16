# Create Android AdMob IDs for PunchPal AI Coach

## Context

PunchPal is a React Native (Expo SDK 54) boxing app that ships on **iOS App Store** with working AdMob ads. We're now shipping the **Android version** to Google Play and need Android-specific AdMob IDs created and wired into the code.

The publisher account is the same as iOS: **`ca-app-pub-8632074296834726`** (Stratega's AdMob publisher). All existing iOS IDs are already in the code at the file paths below — use them as patterns and mirror the naming for Android.

## What you need to create in the AdMob console (admob.google.com)

### 1. Add an Android app

1. AdMob console → **Apps** → **Add app** → choose **Android**, "No, the app is not listed on Google Play yet" (it's pre-launch).
2. App name: **PunchPal AI Coach (Android)**.
3. Enable user metrics: **Yes**.
4. Confirm. AdMob assigns an **App ID** in the form `ca-app-pub-8632074296834726~XXXXXXXXXX` (tilde separator). **Save this — call it `ANDROID_APP_ID`.**

### 2. Create the Android banner ad unit

1. Inside the new Android app → **Ad units** → **Add ad unit** → **Banner**.
2. Ad unit name: **PunchPal Android Banner — Home**.
3. Advanced settings → leave defaults (no frequency cap, no eCPM floor).
4. Save. The unit ID is `ca-app-pub-8632074296834726/XXXXXXXXXX` (slash separator). **Save this — call it `ANDROID_BANNER_ID`.**

### 3. Create the Android interstitial ad unit

1. **Add ad unit** → **Interstitial**.
2. Ad unit name: **PunchPal Android Interstitial — Workout**.
3. Format: **Image, Text, Video** (the default).
4. Save. **Save the unit ID as `ANDROID_INTERSTITIAL_ID`.**

## Where to wire the IDs in code

Three edits, all in the `mobile/` subdirectory. The iOS values are already there — leave them alone, only replace Android.

### Edit 1: `mobile/app.json`

Find the `plugins` array and the `react-native-google-mobile-ads` entry. Replace ONLY the `androidAppId`:

```jsonc
"plugins": [
  ...
  [
    "react-native-google-mobile-ads",
    {
      "androidAppId": "<ANDROID_APP_ID>",   // ← paste here, keep tilde
      "iosAppId": "ca-app-pub-8632074296834726~5383909951"  // ← do not touch
    }
  ]
]
```

### Edit 2: `mobile/src/lib/ads.ts`

Find the two `Platform.select` calls (near lines 58 and 64). Replace ONLY the `android:` values:

```ts
const REAL_BANNER_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-8632074296834726/8728863835",
  android: "<ANDROID_BANNER_ID>",   // ← paste here, keep slash
  default: "",
}) as string;

const REAL_INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-8632074296834726/8623932374",
  android: "<ANDROID_INTERSTITIAL_ID>",   // ← paste here, keep slash
  default: "",
}) as string;
```

### Edit 3: verify the `FORCE_TEST_ADS` toggle

In `mobile/src/lib/ads.ts` near the top, confirm `FORCE_TEST_ADS = false`. This must be `false` for production builds to serve real ads. If it's `true`, leave it as-is for now (the user may have flipped it intentionally for a test build).

## What you do NOT need to do

- **Do not change `iosAppId`** in app.json or any iOS ad unit IDs in `ads.ts` — they're in production.
- **Do not update `app-ads.txt`** at `https://punchpal-ai.lovable.app/app-ads.txt` — it's already a single line covering all platforms for this publisher:
  `google.com, pub-8632074296834726, DIRECT, f08c47fec0942fa0`
- **Do not bump `versionCode`** in app.json — EAS handles that via `autoIncrement: true` in `eas.json`.

## Verification

1. **Sanity check the IDs:**
   - `ANDROID_APP_ID` must start with `ca-app-pub-8632074296834726~` (tilde, exactly 10 digits after).
   - Both ad unit IDs must start with `ca-app-pub-8632074296834726/` (slash, exactly 10 digits after).
   - If either tilde/slash is wrong, the SDK silently fails to load ads.

2. **TypeScript check:**
   ```bash
   cd mobile && bun run typecheck
   ```
   Should print only `$ tsc --noEmit` with no errors.

3. **Build verification:**
   The user will trigger an Android EAS build after these edits — no need to do it yourself. Just commit the three edits with message:
   ```
   feat: wire android admob app + ad unit ids
   ```
   and stop.

## Report back

When done, report:
- The three IDs you saved (`ANDROID_APP_ID`, `ANDROID_BANNER_ID`, `ANDROID_INTERSTITIAL_ID`).
- The three file paths you edited (should be `mobile/app.json` and `mobile/src/lib/ads.ts`).
- Output of `bun run typecheck`.
