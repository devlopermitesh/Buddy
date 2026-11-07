import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logoutToLoginAction } from "@/lib/actions/auth";
import { sha256 } from "@/lib/crypto";
import { ROLE_LABELS, normalizeRole } from "@/lib/permissions";
import { AcceptInviteForm } from "./accept-form";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { workspace: true, inviter: true },
  });

  if (!invitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Invitation not found</h1>
        <p className="text-sm text-muted-foreground">Ask a workspace Admin to send you a new invitation.</p>
        <Button asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const expired = invitation.expiresAt.getTime() < Date.now();
  const used = invitation.status !== "pending";
  const user = await getSessionUser();
  const role = normalizeRole(invitation.role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">Join {invitation.workspace.name}</h1>
          <p className="text-sm text-muted-foreground">
            {invitation.inviter.fullName} invited <span className="font-medium text-foreground">{invitation.email}</span>{" "}
            as {ROLE_LABELS[role]}.
          </p>
        </div>
        {expired || used ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {used ? "This invitation has already been used." : "This invitation has expired."} Ask an Admin to resend it.
          </p>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with <span className="font-medium text-foreground">{invitation.email}</span> to accept.
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>Create an account</Link>
            </Button>
          </div>
        ) : user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
          <div className="space-y-3">
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              You are signed in as {user.email}. This invitation is for {invitation.email}.
            </p>
            <form action={logoutToLoginAction}>
              <input type="hidden" name="next" value={`/invite/${token}`} />
              <Button type="submit" className="w-full">
                Switch account
              </Button>
            </form>
          </div>
        ) : (
          <AcceptInviteForm token={token} />
        )}
      </div>
    </div>
  );
}
