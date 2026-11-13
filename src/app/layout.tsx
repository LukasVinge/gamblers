import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs, TopTabs } from "@/components/NavTabs";
import { signOut } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gamblers", template: "%s · Gamblers" },
  description: "Share odds with your friends and see who actually wins.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            <div className="flex items-center">
              {user ? (
                <form action={signOut}>
                  <button className="text-sm text-muted hover:text-ink">Log out</button>
                </form>
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
