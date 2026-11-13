import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
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

  // Your own name + picture for the top bar.
  let me: { username: string; avatar_url?: string | null } | null = null;
  if (user) {
    const { data, error } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle();
    if (!error) me = data;
    else me = (await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()).data; // before migration 0007
  }

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
                  {me && (
                    <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-ink-2 hover:bg-subtle" title="Your profile">
                      <Avatar url={me.avatar_url} name={me.username} size={30} />
                      <span className="hidden sm:inline">@{me.username}</span>
                    </Link>
                  )}
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
