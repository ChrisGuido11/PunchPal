import React from "react";
import { View } from "react-native";
import { AD_REQUEST_OPTIONS, BANNER_AD_SIZE, BANNER_AD_UNIT_ID, isAdsAvailable } from "../lib/ads";

let BannerAdComponent: React.ComponentType<{
  unitId: string;
  size: typeof BANNER_AD_SIZE;
  requestOptions: typeof AD_REQUEST_OPTIONS;
}> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BannerAdComponent = require("react-native-google-mobile-ads").BannerAd;
} catch {
  BannerAdComponent = null;
}

export default function BannerAdView() {
  if (!isAdsAvailable() || !BannerAdComponent || !BANNER_AD_SIZE || !BANNER_AD_UNIT_ID) {
    return null;
  }
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <BannerAdComponent
        unitId={BANNER_AD_UNIT_ID}
        size={BANNER_AD_SIZE}
        requestOptions={AD_REQUEST_OPTIONS}
      />
    </View>
  );
}
