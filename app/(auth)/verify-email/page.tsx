import Link from "next/link";
import { MailCheck } from "lucide-react";
import { VerifyEmailForm, ResendVerificationForm } from "./verify-forms";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; sent?: string; unverified?: string; next?: string }>;
}) {
  const { token, email, sent, unverified, next } = await searchParams;
  return (
    <div className="space-y-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="h-5 w-5" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {token ? "Verify your email" : "Check your inbox"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {token
            ? "Confirm your email address to finish setting up your account."
            : sent
              ? "We sent you a verification link. It expires in 24 hours."
              : unverified
                ? "Your email isn't verified yet. Open the link we sent, or request a new one."
                : "Open the verification link we emailed you to continue."}
        </p>
      </div>
      {token ? <VerifyEmailForm token={token} next={next} /> : null}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Need a new link?</p>
        <ResendVerificationForm defaultEmail={email ?? ""} next={next} />
        <p className="text-xs text-muted-foreground">
          In local development, view emails in{" "}
          <Link href="/dev/outbox" className="font-medium text-primary hover:underline">
            /dev/outbox
          </Link>
          .
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
