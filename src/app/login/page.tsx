import Link from "next/link";
import { login } from "../actions";
import { btnPrimary, Card, Field, inputCls, Notice } from "@/components/ui";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <Notice error={error} />
      <Card className="p-5">
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
          </Field>
          <button className={`${btnPrimary} w-full`}>Log in</button>
        </form>
      </Card>
      <p className="text-sm text-muted">
        New here? You need an invite link from someone in the league.{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up with an invite
        </Link>
      </p>
    </div>
  );
}
