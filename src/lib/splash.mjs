// iPhone screen sizes (CSS points, portrait) and pixel ratio – one launch image each.
// Shared by scripts/make-splash.mjs (draws the images) and the root layout (links them).
export const SPLASH_SCREENS = [
  { w: 440, h: 956, r: 3 }, // 16 Pro Max, 17 Pro Max
  { w: 430, h: 932, r: 3 }, // 14 Pro Max, 15/16 Plus, 15 Pro Max
  { w: 428, h: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 420, h: 912, r: 3 }, // iPhone Air
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 414, h: 736, r: 3 }, // 6/7/8 Plus
  { w: 402, h: 874, r: 3 }, // 16 Pro, 17, 17 Pro
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 390, h: 844, r: 3 }, // 12, 13, 14, 12/13 Pro
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 375, h: 667, r: 2 }, // SE 2/3, 6/7/8
];
