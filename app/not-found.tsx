import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page may have moved, or you may not have access to it.
      </p>
      <Button asChild>
        <Link href="/">Back to SocialFlow</Link>
      </Button>
    </div>
  );
}
