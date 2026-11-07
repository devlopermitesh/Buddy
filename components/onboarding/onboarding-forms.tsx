"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ThumbsUp, MessageCircle, Link2 } from "lucide-react";
import {
  connectDiscordAction,
  connectSocialAccountAction,
  createWorkspaceAction,
  inviteOnboardingMemberAction,
} from "@/lib/actions/onboarding";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function WorkspaceStepForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useActionState(createWorkspaceAction, null);
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(slugify(defaultName));
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <FormMessage error={state?.error} message={state?.message} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              placeholder="Acme Social"
              required
            />
            {state?.fieldErrors?.name ? <p className="text-xs text-red-600">{state.fieldErrors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Workspace URL</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">/w/</span>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(slugify(event.target.value));
                }}
                required
              />
            </div>
            {state?.fieldErrors?.slug ? <p className="text-xs text-red-600">{state.fieldErrors.slug}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Select id="timezone" name="timezone" defaultValue="UTC">
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton className="w-full" pendingText="Creating workspace…">
            Create workspace
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function InviteStepForm() {
  const [state, formAction] = useActionState(inviteOnboardingMemberAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a teammate</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <FormMessage error={state?.error} message={state?.message} />
          {state?.devLink ? (
            <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Local invite link:{" "}
              <a href={state.devLink} className="font-medium text-primary hover:underline">
                {state.devLink}
              </a>
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" required />
              {state?.fieldErrors?.email ? <p className="text-xs text-red-600">{state.fieldErrors.email}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" name="role" defaultValue="executive">
                <option value="manager">Manager</option>
                <option value="executive">Executive</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>
          <SubmitButton variant="outline" pendingText="Sending…">
            Send invitation
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

type AccountSummary = { id: string; platform: string; accountName: string; status: string };

export function SocialStepForm({ accounts }: { accounts: AccountSummary[] }) {
  const [state, formAction] = useActionState(connectSocialAccountAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connect an account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormMessage error={state?.error} message={state?.message} />
        <form action={formAction} className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            name="platform"
            value="instagram"
            className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition hover:border-primary/50 hover:bg-muted"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600">
              <Camera className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Instagram</span>
              <span className="block text-xs text-muted-foreground">Business account (mock)</span>
            </span>
          </button>
          <button
            type="submit"
            name="platform"
            value="facebook"
            className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition hover:border-primary/50 hover:bg-muted"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <ThumbsUp className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Facebook Page</span>
              <span className="block text-xs text-muted-foreground">Page access (mock)</span>
            </span>
          </button>
        </form>
        {accounts.length > 0 ? (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {account.platform === "instagram" ? (
                    <Camera className="h-4 w-4 text-pink-600" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 text-blue-600" />
                  )}
                  {account.accountName}
                </span>
                <Badge variant={account.status === "active" ? "success" : "warning"}>{account.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No accounts connected yet. You can add them later.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DiscordStepForm() {
  const [state, formAction] = useActionState(connectDiscordAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> Discord server
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <FormMessage error={state?.error} message={state?.message} />
          <div className="space-y-1.5">
            <Label htmlFor="guildName">Server name</Label>
            <Input id="guildName" name="guildName" defaultValue="Demo Brand HQ" />
          </div>
          <SubmitButton pendingText="Connecting…">
            <Link2 className="h-4 w-4" /> Connect Discord (mock)
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            This creates a mock server connection and links your Discord user for command testing.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
