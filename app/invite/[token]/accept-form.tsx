"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/lib/actions/auth";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(acceptInvitationAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state?.error} message={state?.message} />
      <SubmitButton className="w-full" pendingText="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
