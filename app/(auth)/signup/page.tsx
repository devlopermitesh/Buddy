import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, resolvePostLoginPath } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { SignupForm } from "./signup-form";

async function inviteForNext(next: string | undefined) {
  if (!next || !next.startsWith("/invite/")) return null;
  const token = next.slice("/invite/".length).split("?")[0];
  if (!token) return null;
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { workspace: true },
  });
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt.getTime() < Date.now()) return null;
  return invitation;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(await resolvePostLoginPath(user.id));
  const { next } = await searchParams;
  const invitation = await inviteForNext(next);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {invitation ? `Join ${invitation.workspace.name}` : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {invitation
            ? `Create an account for ${invitation.email} to accept your invitation.`
            : "Start with a workspace, then invite your team."}
        </p>
      </div>
      <SignupForm next={next} lockedEmail={invitation?.email} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
