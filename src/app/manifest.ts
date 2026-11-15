import type { MetadataRoute } from "next";

// Makes the site installable as an app ("Add to Home Screen"): own icon, full screen, no browser bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gamblers",
    short_name: "Gamblers",
    description: "Share odds with your friends and see who actually wins.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#ffffff",
    lang: "en",
    categories: ["sports", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nyt spilforslag", short_name: "Nyt spil", url: "/new" },
      { name: "Kampprogram", url: "/kampprogram" },
      { name: "Leaderboard", url: "/leaderboard" },
    ],
  };
}
