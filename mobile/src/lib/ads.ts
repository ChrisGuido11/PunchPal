import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import type {
  BannerAdSize as BannerAdSizeType,
} from "react-native-google-mobile-ads";

// ============================================================
// SAFE-TESTING TOGGLE
// ============================================================
// Flip to `true` to force GOOGLE TEST ADS even in production builds
// (preview / TestFlight / App Store). Use this when testing your own
// build to avoid accidentally clicking real ads (which can suspend
// your AdMob account).
//
//   true  → test ads everywhere — SAFE to tap any ad
//   false → real ads in production, test ads only in dev — REVENUE-ON
//
// MUST be set to `false` before submitting the final build to the App Store.
// ============================================================
const FORCE_TEST_ADS = false;

// Optional: paste specific device IDs here if you ever capture them
// (via Xcode console or AdMob diagnostic logs). Not required when
// FORCE_TEST_ADS is false — real ads in production builds.
const TEST_DEVICE_IDS: string[] = [];

// Dynamically load the native ads module. In Expo Go (no custom dev client),
// the native binary doesn't include RNGoogleMobileAdsModule and `require`
// throws via TurboModuleRegistry. We degrade to no-op ads so the rest of the
// app keeps working. Real ads still serve in EAS dev/production builds.
type AdsModule = typeof import("react-native-google-mobile-ads");
let adsModule: AdsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  adsModule = require("react-native-google-mobile-ads") as AdsModule;
  adsModule
    .default()
    .setRequestConfiguration({
      maxAdContentRating: adsModule.MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: TEST_DEVICE_IDS,
    })
    .then(() => adsModule!.default().initialize())
    .catch((err: unknown) => {
      console.warn("[Ads] Mobile Ads SDK setup failed:", err);
    });
} catch {
  console.log("[Ads] Native module unavailable — ads disabled (Expo Go?)");
  adsModule = null;
}

export const isAdsAvailable = (): boolean => adsModule !== null;

const useTestIds = __DEV__ || FORCE_TEST_ADS;

// Production builds (TestFlight + App Store) auto-switch to these via __DEV__.
const REAL_BANNER_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-8632074296834726/8728863835",
  android: "ca-app-pub-8632074296834726/9712425409",
  default: "",
}) as string;

const REAL_INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-8632074296834726/8623932374",
  android: "ca-app-pub-8632074296834726/6960927537",
  default: "",
}) as string;

export const BANNER_AD_UNIT_ID = adsModule
  ? useTestIds
    ? adsModule.TestIds.BANNER
    : REAL_BANNER_AD_UNIT_ID
  : "";

export const INTERSTITIAL_AD_UNIT_ID = adsModule
  ? useTestIds
    ? adsModule.TestIds.INTERSTITIAL
    : REAL_INTERSTITIAL_AD_UNIT_ID
  : "";

// App Open ad — Android only. iOS intentionally empty so the format never
// shows on iOS. App Open displays on cold launch and on return-to-foreground.
const REAL_APP_OPEN_AD_UNIT_ID = Platform.select({
  android: "ca-app-pub-8632074296834726/5074916631", // PunchPal Android App Open
  ios: "",
  default: "",
}) as string;

export const APP_OPEN_AD_UNIT_ID = adsModule
  ? useTestIds
    ? adsModule.TestIds.APP_OPEN
    : REAL_APP_OPEN_AD_UNIT_ID
  : "";

export const BANNER_AD_SIZE: BannerAdSizeType | undefined =
  adsModule?.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
} as const;

const MIN_INTERSTITIAL_INTERVAL_MS = 30_000;
let lastInterstitialShownAt = 0;

const isFrequencyCapped = (): boolean =>
  Date.now() - lastInterstitialShownAt < MIN_INTERSTITIAL_INTERVAL_MS;

// Shared across ALL full-screen ad formats (interstitial + App Open). True
// while any full-screen ad is presenting. The App Open ad reads this so it
// never stacks on top of an interstitial: on Android, an interstitial renders
// in its own Activity that covers the host, so dismissing it looks identical
// to a normal app resume to AppState. useAppOpenAd snapshots this flag at the
// moment the app is backgrounded to decide whether a resume was a genuine
// re-open or just the return from an in-app ad.
let isFullScreenAdShowing = false;

export interface UseInterstitialResult {
  show: (onDismiss?: () => void) => void;
  isLoaded: boolean;
}

export const useInterstitial = (unitId: string): UseInterstitialResult => {
  const interstitial = useMemo(() => {
    if (!adsModule || !unitId) return null;
    try {
      return adsModule.InterstitialAd.createForAdRequest(unitId, AD_REQUEST_OPTIONS);
    } catch (err) {
      console.warn("[Ads] Interstitial create failed:", err);
      return null;
    }
  }, [unitId]);
  const [isLoaded, setIsLoaded] = useState(false);
  const onDismissRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!interstitial || !adsModule) return;

    const fireDismiss = () => {
      const cb = onDismissRef.current;
      onDismissRef.current = null;
      cb?.();
    };

    const unsubLoaded = interstitial.addAdEventListener(
      adsModule.AdEventType.LOADED,
      () => {
        setIsLoaded(true);
      }
    );
    const unsubClosed = interstitial.addAdEventListener(
      adsModule.AdEventType.CLOSED,
      () => {
        setIsLoaded(false);
        isFullScreenAdShowing = false;
        fireDismiss();
        interstitial.load();
      }
    );
    const unsubError = interstitial.addAdEventListener(
      adsModule.AdEventType.ERROR,
      (err) => {
        console.warn("[Ads] Interstitial error:", err);
        setIsLoaded(false);
        isFullScreenAdShowing = false;
        fireDismiss();
      }
    );

    interstitial.load();

    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
    };
  }, [interstitial]);

  const show = useCallback(
    (onDismiss?: () => void) => {
      const dismiss = onDismiss ?? (() => {});
      // Skip if not ready, frequency-capped, OR another full-screen ad (an App
      // Open) is currently up — but still run the callback so flow continues.
      if (
        !interstitial ||
        !isLoaded ||
        isFrequencyCapped() ||
        isFullScreenAdShowing
      ) {
        dismiss();
        return;
      }
      onDismissRef.current = dismiss;
      lastInterstitialShownAt = Date.now();
      isFullScreenAdShowing = true;
      try {
        interstitial.show();
      } catch (err) {
        console.warn("[Ads] Interstitial show failed:", err);
        isFullScreenAdShowing = false;
        onDismissRef.current = null;
        dismiss();
      }
    },
    [interstitial, isLoaded]
  );

  return { show, isLoaded };
};

// ============================================================
// APP OPEN AD (Android only) — cold start + resume from background
// ============================================================
const APP_OPEN_COOLDOWN_MS = 60_000; // min gap between app-open shows (resume spam guard)
const APP_OPEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // App Open ads expire ~4h after load
// If OPENED doesn't arrive this soon after show(), assume the present failed.
// The native SDK has no onAdFailedToShowFullScreenContent callback, so a failed
// show emits NO event — without this watchdog the "show in flight" guard would
// stay set forever and silently kill the format for the session.
const APP_OPEN_SHOW_WATCHDOG_MS = 3_000;
const APP_OPEN_ERROR_RETRY_MS = 20_000; // backoff before retrying a failed load
const APP_OPEN_MAX_ERROR_RETRIES = 3;

// Mount once at the app root. Loads an App Open ad and shows it on cold start
// (once loaded) and whenever the app returns to the foreground. Self-disables
// on iOS, in Expo Go (no native module), and when no unit ID is configured.
export const useAppOpenAd = (): void => {
  const isEnabled =
    Platform.OS === "android" && !!adsModule && !!APP_OPEN_AD_UNIT_ID;

  // Bumped to rebuild the ad instance after expiry: the native load() no-ops on
  // a stale-but-still-"loaded" instance, so the only way to refresh is a new one.
  const [reloadKey, setReloadKey] = useState(0);

  const appOpenAd = useMemo(() => {
    if (!isEnabled || !adsModule) return null;
    try {
      return adsModule.AppOpenAd.createForAdRequest(
        APP_OPEN_AD_UNIT_ID,
        AD_REQUEST_OPTIONS
      );
    } catch (err) {
      console.warn("[Ads] AppOpen create failed:", err);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, reloadKey]);

  const isLoadedRef = useRef(false);
  const loadedAtRef = useRef(0);
  const isShowingRef = useRef(false); // OPENED fired, CLOSED not yet — ad on screen
  const isShowPendingRef = useRef(false); // show() called, OPENED not yet confirmed
  const lastShownAtRef = useRef(0);
  const hasShownColdStartRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRetryCountRef = useRef(0);

  useEffect(() => {
    if (!appOpenAd || !adsModule) return;

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
    const clearErrorRetry = () => {
      if (errorRetryRef.current) {
        clearTimeout(errorRetryRef.current);
        errorRetryRef.current = null;
      }
    };

    const showIfReady = () => {
      if (!isLoadedRef.current) return;
      if (isShowingRef.current || isShowPendingRef.current) return;
      if (isFullScreenAdShowing) return; // an interstitial (or any ad) is up
      // Expired: the library won't reload a stale instance, so rebuild it.
      if (Date.now() - loadedAtRef.current >= APP_OPEN_EXPIRY_MS) {
        isLoadedRef.current = false;
        setReloadKey((k) => k + 1);
        return;
      }
      if (Date.now() - lastShownAtRef.current < APP_OPEN_COOLDOWN_MS) return;

      const settleFailure = (err: unknown) => {
        console.warn("[Ads] AppOpen show failed:", err);
        clearWatchdog();
        isShowPendingRef.current = false;
        isShowingRef.current = false;
        isFullScreenAdShowing = false;
        isLoadedRef.current = false;
        appOpenAd.load();
      };

      isShowPendingRef.current = true;
      lastShownAtRef.current = Date.now();
      // Watchdog: recover if the present silently fails (no event is emitted).
      watchdogRef.current = setTimeout(() => {
        if (!isShowingRef.current) settleFailure(new Error("show timed out"));
      }, APP_OPEN_SHOW_WATCHDOG_MS);

      try {
        // show() returns a Promise that rejects (e.g. null Activity during a
        // resume race) — a sync try/catch can't see that, so chain .catch too.
        appOpenAd.show().catch(settleFailure);
      } catch (err) {
        settleFailure(err);
      }
    };

    const unsubLoaded = appOpenAd.addAdEventListener(
      adsModule.AdEventType.LOADED,
      () => {
        isLoadedRef.current = true;
        loadedAtRef.current = Date.now();
        errorRetryCountRef.current = 0;
        clearErrorRetry();
        // Cold start: show as soon as the first ad finishes loading.
        if (!hasShownColdStartRef.current) {
          hasShownColdStartRef.current = true;
          showIfReady();
        }
      }
    );
    // OPENED is the source of truth that the ad is actually on screen.
    const unsubOpened = appOpenAd.addAdEventListener(
      adsModule.AdEventType.OPENED,
      () => {
        clearWatchdog();
        isShowPendingRef.current = false;
        isShowingRef.current = true;
        isFullScreenAdShowing = true;
      }
    );
    const unsubClosed = appOpenAd.addAdEventListener(
      adsModule.AdEventType.CLOSED,
      () => {
        clearWatchdog();
        isShowPendingRef.current = false;
        isShowingRef.current = false;
        isFullScreenAdShowing = false;
        isLoadedRef.current = false;
        appOpenAd.load(); // preload the next one
      }
    );
    const unsubError = appOpenAd.addAdEventListener(
      adsModule.AdEventType.ERROR,
      (err) => {
        console.warn("[Ads] AppOpen error:", err);
        clearWatchdog();
        isShowPendingRef.current = false;
        isShowingRef.current = false;
        isFullScreenAdShowing = false;
        isLoadedRef.current = false;
        // Bounded retry so a transient load failure doesn't lose the session.
        if (errorRetryCountRef.current < APP_OPEN_MAX_ERROR_RETRIES) {
          errorRetryCountRef.current += 1;
          clearErrorRetry();
          errorRetryRef.current = setTimeout(() => {
            if (!isLoadedRef.current) appOpenAd.load();
          }, APP_OPEN_ERROR_RETRY_MS);
        }
      }
    );

    appOpenAd.load();

    // Resume: show when the app returns to the foreground — but NOT when the
    // foreground is just the return from an interstitial/App Open Activity.
    let prevState = AppState.currentState;
    let backgroundedByAd = false;
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground =
        prevState === "background" || prevState === "inactive";
      const goingBackground = next === "background" || next === "inactive";
      // Snapshot at background-time (race-free): if a full-screen ad was up when
      // we left foreground, the matching return is an ad dismissal, not a resume.
      if (goingBackground && !wasBackground) {
        backgroundedByAd = isFullScreenAdShowing;
      }
      const cameToForeground = wasBackground && next === "active";
      prevState = next;
      if (!cameToForeground) return;

      if (backgroundedByAd) {
        backgroundedByAd = false;
        isFullScreenAdShowing = false; // back in the app; nothing is showing
        if (!isLoadedRef.current && !isShowPendingRef.current) appOpenAd.load();
        return;
      }
      if (isLoadedRef.current) {
        showIfReady();
      } else if (!isShowPendingRef.current) {
        appOpenAd.load();
      }
    });

    return () => {
      unsubLoaded();
      unsubOpened();
      unsubClosed();
      unsubError();
      sub.remove();
      clearWatchdog();
      clearErrorRetry();
    };
  }, [appOpenAd]);
};
