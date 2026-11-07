"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Something went wrong</p>
      <h1 className="text-2xl font-semibold">We hit an unexpected error</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page could not be loaded. Retry the request, or head back to your workspace.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
