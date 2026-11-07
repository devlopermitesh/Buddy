"use client";

import { useActionState } from "react";
import { resendVerificationAction, verifyEmailAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function VerifyEmailForm({ token, next }: { token: string; next?: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage error={state?.error} message={state?.message} />
      <SubmitButton className="w-full" pendingText="Verifying…">
        Verify email
      </SubmitButton>
    </form>
  );
}

export function ResendVerificationForm({ defaultEmail, next }: { defaultEmail: string; next?: string }) {
  const [state, formAction] = useActionState(resendVerificationAction, null);
  return (
    <form action={formAction} className="space-y-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage error={state?.error} message={state?.message} />
      <div className="space-y-1.5">
        <Label htmlFor="resend-email">Email</Label>
        <Input id="resend-email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <SubmitButton variant="outline" className="w-full" pendingText="Sending…">
        Resend verification email
      </SubmitButton>
    </form>
  );
}
