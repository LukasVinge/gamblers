import Link from "next/link";
import { signup } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary, Card, Field, inputCls, Notice } from "@/components/ui";

export const metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code = "", error } = await searchParams;
  const supabase = await createClient();

  const [{ data: open }, { data: groupName }] = await Promise.all([
    supabase.rpc("signup_open"),
    code ? supabase.rpc("check_invite", { p_code: code }) : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Create your account</h1>
        {open ? (
          <p className="text-sm text-muted">
            You&apos;re the first one here, so no invite is needed. You&apos;ll be the admin of Gamblers – after signing up, share its
            invite link with your friends.
          </p>
        ) : groupName ? (
          <p className="text-sm text-muted">
            You&apos;ve been invited to <strong className="text-ink">{groupName as string}</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted">This league is invite only. Paste the invite code a friend sent you.</p>
        )}
      </div>
      <Notice error={error ?? (code && !groupName && !open ? "That invite code isn't valid (anymore)." : undefined)} />
      <Card className="p-5">
        <form action={signup} className="space-y-4">
          {!open && (
            <Field label="Invite code">
              <input name="code" defaultValue={code} required className={`${inputCls} font-mono`} />
            </Field>
          )}
          <Field label="Username" hint="Shown on tips and the leaderboard. 3–20 letters, numbers or _">
            <input name="username" required pattern="[a-zA-Z0-9_]{3,20}" autoComplete="username" className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
          </Field>
          <button className={`${btnPrimary} w-full`}>Sign up</button>
        </form>
      </Card>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href={code ? `/login?next=/join/${encodeURIComponent(code)}` : "/login"} className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
