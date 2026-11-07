"use client";

import { useActionState } from "react";
import { signupAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function SignupForm({ next, lockedEmail }: { next?: string; lockedEmail?: string }) {
  const [state, formAction] = useActionState(signupAction, null);
  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage error={state?.error} message={state?.message} />
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="Alex Morgan" required />
        {state?.fieldErrors?.fullName ? <p className="text-xs text-red-600">{state.fieldErrors.fullName}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={lockedEmail ?? ""}
          readOnly={Boolean(lockedEmail)}
          className={lockedEmail ? "bg-muted text-muted-foreground" : undefined}
          required
        />
        {lockedEmail ? (
          <p className="text-xs text-muted-foreground">Your invitation is tied to this email address.</p>
        ) : null}
        {state?.fieldErrors?.email ? <p className="text-xs text-red-600">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <p className="text-xs text-muted-foreground">At least 10 characters with upper, lower and a number.</p>
        {state?.fieldErrors?.password ? <p className="text-xs text-red-600">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-red-600">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
