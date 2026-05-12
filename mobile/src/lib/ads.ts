import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
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
// FORCE_TEST_ADS is true.
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
  android: "ca-app-pub-8632074296834726/3668108840",
  default: "",
}) as string;

const REAL_INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-8632074296834726/8623932374",
  android: "ca-app-pub-8632074296834726/2140238903",
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

export const BANNER_AD_SIZE: BannerAdSizeType | undefined =
  adsModule?.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
} as const;

const MIN_INTERSTITIAL_INTERVAL_MS = 30_000;
let lastInterstitialShownAt = 0;

const isFrequencyCapped = (): boolean =>
  Date.now() - lastInterstitialShownAt < MIN_INTERSTITIAL_INTERVAL_MS;

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
        fireDismiss();
        interstitial.load();
      }
    );
    const unsubError = interstitial.addAdEventListener(
      adsModule.AdEventType.ERROR,
      (err) => {
        console.warn("[Ads] Interstitial error:", err);
        setIsLoaded(false);
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
      if (!interstitial || !isLoaded || isFrequencyCapped()) {
        dismiss();
        return;
      }
      onDismissRef.current = dismiss;
      lastInterstitialShownAt = Date.now();
      try {
        interstitial.show();
      } catch (err) {
        console.warn("[Ads] Interstitial show failed:", err);
        onDismissRef.current = null;
        dismiss();
      }
    },
    [interstitial, isLoaded]
  );

  return { show, isLoaded };
};
