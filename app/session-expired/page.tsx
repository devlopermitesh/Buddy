import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
        <Clock className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-semibold">Your session expired</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        For security, sessions end after 30 days. Sign in again to pick up where you left off.
      </p>
      {next ? (
        <p className="max-w-md text-xs text-muted-foreground">
          You&apos;ll be returned to the page you were trying to open.
        </p>
      ) : null}
      <Button asChild>
        <Link href={loginHref}>Sign in again</Link>
      </Button>
    </div>
  );
}
