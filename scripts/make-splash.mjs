// Generates the iPhone launch screens ("splash") shown while the app starts from the home screen.
// Without them iPhone shows a blank (black in dark mode) screen until the first page arrives.
// Run from the project folder:  node scripts/make-splash.mjs
// The list must match SPLASH_SCREENS in src/lib/splash.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";
import { SPLASH_SCREENS } from "../src/lib/splash.mjs";

mkdirSync("public/splash", { recursive: true });

for (const s of SPLASH_SCREENS) {
  const width = s.w * s.r;
  const height = s.h * s.r;
  const icon = Math.round(width * 0.26);
  const el = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: icon * 0.22,
        background: "#f4f5f7",
      },
    },
    h(
      "div",
      {
        style: {
          width: icon,
          height: icon,
          borderRadius: icon * 0.23,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)",
          color: "#ffffff",
          fontSize: icon * 0.62,
          lineHeight: 1,
          paddingBottom: icon * 0.04,
          textShadow: [0, 45, 90, 135, 180, 225, 270, 315]
            .map((deg) => `${(Math.cos((deg * Math.PI) / 180) * icon * 0.016).toFixed(2)}px ${(Math.sin((deg * Math.PI) / 180) * icon * 0.016).toFixed(2)}px 0 #ffffff`)
            .join(", "),
        },
      },
      "G",
    ),
    h("div", { style: { fontSize: icon * 0.2, letterSpacing: icon * 0.02, color: "#0f172a" } }, "GAMBLERS"),
  );
  const res = new ImageResponse(el, { width, height });
  const file = `public/splash/${width}x${height}.png`;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}
