"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state?.error} message={state?.message} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        {state?.fieldErrors?.password ? <p className="text-xs text-red-600">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-red-600">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      <SubmitButton className="w-full" pendingText="Updating password…">
        Update password
      </SubmitButton>
    </form>
  );
}
