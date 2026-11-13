import Link from "next/link";
import { redirect } from "next/navigation";
import { joinGroup } from "../../actions";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary, Card, Notice } from "@/components/ui";

export const metadata = { title: "Join group" };

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → sign up with this invite code (the signup links to login for existing users).
  if (!user) redirect(`/signup?code=${encodeURIComponent(code)}`);

  const { data: groupName } = await supabase.rpc("check_invite", { p_code: code });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <Notice error={error} />
      <Card className="space-y-4 p-6 text-center">
        {groupName ? (
          <>
            <p className="text-sm text-muted">You&apos;ve been invited to</p>
            <h1 className="text-2xl font-bold">{groupName as string}</h1>
            <form action={joinGroup}>
              <input type="hidden" name="code" value={code} />
              <button className={`${btnPrimary} w-full`}>Join group</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Invite not valid</h1>
            <p className="text-sm text-muted">This link has expired or was replaced. Ask your friend for a new one.</p>
            <Link href="/" className="text-sm text-accent hover:underline">
              Back to the tips
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
