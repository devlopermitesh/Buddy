"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state?.error} message={state?.message} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
      </div>
      <SubmitButton className="w-full" pendingText="Sending link…">
        Send reset link
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        In local development, open{" "}
        <a href="/dev/outbox" className="font-medium text-primary hover:underline">
          /dev/outbox
        </a>{" "}
        to see the email and link.
      </p>
    </form>
  );
}
