import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionUser, resolvePostLoginPath } from "@/lib/auth";

export default async function ForbiddenPage() {
  const user = await getSessionUser();
  const home = user ? await resolvePostLoginPath(user.id) : "/login";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this area</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ask a workspace Admin to adjust your role or permissions if you believe this is a mistake.
      </p>
      <Button asChild>
        <Link href={home}>Go back</Link>
      </Button>
    </div>
  );
}
