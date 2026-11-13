import Link from "next/link";
import { btnPrimary, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md space-y-3 p-8 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-xl font-bold">This page doesn&apos;t exist</h1>
      <p className="text-sm text-muted">The link may be old, or the tip was deleted.</p>
      <Link href="/" className={btnPrimary}>
        Back to Spilforslag
      </Link>
    </Card>
  );
}
