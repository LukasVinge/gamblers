import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getAuth, getMyProfile } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { BottomTabs, TopTabs } from "@/components/NavTabs";
import { SPLASH_SCREENS } from "@/lib/splash.mjs";
import { signOut } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gamblers", template: "%s · Gamblers" },
  description: "Share odds with your friends and see who actually wins.",
  applicationName: "Gamblers",
  // iPhone: run full screen with our own title when opened from the home screen
  appleWebApp: {
    capable: true,
    title: "Gamblers",
    statusBarStyle: "default",
    // Launch screens: shown at once when the app opens, instead of a blank (black) screen while the page loads
    startupImage: SPLASH_SCREENS.map((s) => ({
      url: `/splash/${s.w * s.r}x${s.h * s.r}.png`,
      media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  // Next.js only writes the new "mobile-web-app-capable" tag; iPhone looks for the Apple one before using launch screens
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover", // lets the bottom tab bar sit above the iPhone home indicator
};

/** Your picture + name in the top bar. Loads on its own, so it never delays the page. */
async function UserChip() {
  const me = await getMyProfile();
  if (!me) return null;
  return (
    <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-ink-2 hover:bg-subtle" title="Your profile">
      <Avatar url={me.avatar_url} name={me.username} size={30} />
      <span className="hidden sm:inline">@{me.username}</span>
    </Link>
  );
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Local token check only – the layout never waits for the database, so the page starts loading at once.
  const { user } = await getAuth();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-stretch justify-between gap-4 px-4">
            <div className="flex items-stretch gap-6">
              <Link href="/" className="flex items-center text-lg font-black uppercase tracking-tight text-ink">
                Gamblers
              </Link>
              {user && <TopTabs />}
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Suspense fallback={<span className="h-[30px] w-[30px] rounded-full bg-subtle" />}>
                    <UserChip />
                  </Suspense>
                  <form action={signOut}>
                    <button className="text-sm text-muted hover:text-ink">Log out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className={`mx-auto max-w-3xl px-4 py-6 sm:py-8 ${user ? "pb-28 sm:pb-8" : ""}`}>{children}</main>

        <footer className={`mx-auto max-w-3xl px-4 text-xs text-faint ${user ? "pb-28 sm:pb-10" : "pb-10"}`}>
          Just for tracking tips between friends – no money is handled here. 18+. Play responsibly · stopspillet.dk · ROFUS
        </footer>

        {user && <BottomTabs />}
      </body>
    </html>
  );
}
