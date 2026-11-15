// Generates the app icons (blue square with a white "G").
// Run from the project folder:  node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";

async function icon(size, file) {
  const el = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)",
        color: "#ffffff",
        fontSize: size * 0.62,
        lineHeight: 1,
        // The bundled font has no bold weight – thicken the letter with white shadows all around.
        textShadow: [0, 45, 90, 135, 180, 225, 270, 315]
          .map((deg) => `${(Math.cos((deg * Math.PI) / 180) * size * 0.016).toFixed(2)}px ${(Math.sin((deg * Math.PI) / 180) * size * 0.016).toFixed(2)}px 0 #ffffff`)
          .join(", "),
        paddingBottom: size * 0.04,
      },
    },
    "G",
  );
  const res = new ImageResponse(el, { width: size, height: size });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

await icon(192, "public/icon-192.png");
await icon(512, "public/icon-512.png");
await icon(180, "src/app/apple-icon.png");
await icon(64, "src/app/icon.png");
