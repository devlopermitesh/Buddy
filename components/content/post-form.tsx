"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Camera, Image as ImageIcon, Send, CalendarClock, Save } from "lucide-react";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";

type AccountOption = { id: string; accountName: string; platform: string; username: string | null };
type MediaOption = { id: string; fileName: string; publicUrl: string | null; type: string; altText: string | null };
type CampaignOption = { id: string; name: string };

type PostValues = {
  id?: string;
  title?: string | null;
  baseCaption?: string | null;
  format?: string;
  campaignId?: string | null;
  targetAccountIds?: string[];
  targetCaptions?: Record<string, string>;
  mediaIds?: string[];
};

export function PostForm({
  slug,
  action,
  accounts,
  media,
  campaigns,
  post,
  defaultScheduleAt,
}: {
  slug: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  accounts: AccountOption[];
  media: MediaOption[];
  campaigns: CampaignOption[];
  post?: PostValues;
  defaultScheduleAt?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [caption, setCaption] = useState(post?.baseCaption ?? "");
  const [format, setFormat] = useState(post?.format ?? "feed_post");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(post?.targetAccountIds ?? accounts.map((account) => account.id));
  const [selectedMedia, setSelectedMedia] = useState<string[]>(post?.mediaIds ?? []);

  const selectedAssets = media.filter((asset) => selectedMedia.includes(asset.id));
  const firstAsset = selectedAssets[0];
  const instagramSelected = accounts.some((account) => selectedAccounts.includes(account.id) && account.platform === "instagram");

  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" name="workspaceSlug" value={slug} />
      {post?.id ? <input type="hidden" name="postId" value={post.id} /> : null}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormMessage error={state?.error} message={state?.message} />
            <div className="space-y-1.5">
              <Label htmlFor="title">Internal title</Label>
              <Input id="title" name="title" defaultValue={post?.title ?? ""} placeholder="Spring launch teaser" required />
              {state?.fieldErrors?.title ? <p className="text-xs text-red-600">{state.fieldErrors.title}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caption">Base caption</Label>
              <Textarea
                id="caption"
                name="caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Write the caption. Hashtags are tracked automatically."
                className="min-h-[160px]"
                required
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{caption.length} characters</span>
                <span>{Array.from(new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])).length} hashtags</span>
              </div>
              {state?.fieldErrors?.caption ? <p className="text-xs text-red-600">{state.fieldErrors.caption}</p> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="format">Format</Label>
                <Select id="format" name="format" value={format} onChange={(event) => setFormat(event.target.value)}>
                  <option value="feed_post">Feed post</option>
                  <option value="carousel">Carousel</option>
                  <option value="reel">Reel / video</option>
                  <option value="story">Story</option>
                  <option value="text">Text only</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaignId">Campaign</Label>
                <Select id="campaignId" name="campaignId" defaultValue={post?.campaignId ?? ""}>
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduleAt">Schedule for</Label>
              <Input id="scheduleAt" name="scheduleAt" type="datetime-local" defaultValue={defaultScheduleAt ?? ""} />
              <p className="text-xs text-muted-foreground">
                Required when you choose Schedule or Publish. Times use your browser timezone.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media</CardTitle>
            <p className="text-xs text-muted-foreground">
              Instagram requires at least one image or video. Carousels need 2–10 items.
            </p>
          </CardHeader>
          <CardContent>
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media yet.{" "}
                <Link href={`/w/${slug}/media`} className="font-medium text-primary hover:underline">
                  Upload assets
                </Link>
                .
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {media.map((asset) => {
                  const checked = selectedMedia.includes(asset.id);
                  return (
                    <label
                      key={asset.id}
                      className={cn(
                        "group relative cursor-pointer overflow-hidden rounded-lg border bg-muted",
                        checked ? "border-primary ring-2 ring-primary/30" : "border-border",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="mediaIds"
                        value={asset.id}
                        checked={checked}
                        onChange={(event) =>
                          setSelectedMedia((current) =>
                            event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                          )
                        }
                        className="sr-only"
                      />
                      <div className="aspect-square">
                        {asset.publicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.publicUrl} alt={asset.altText ?? asset.fileName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white">
                        <p className="truncate">{asset.fileName}</p>
                      </div>
                      {checked ? (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {selectedMedia.indexOf(asset.id) + 1}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts</CardTitle>
            <p className="text-xs text-muted-foreground">Select every account this post should go to.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active accounts.{" "}
                <Link href={`/w/${slug}/accounts`} className="font-medium text-primary hover:underline">
                  Connect an account
                </Link>
                .
              </p>
            ) : (
              accounts.map((account) => {
                const checked = selectedAccounts.includes(account.id);
                return (
                  <div key={account.id} className="rounded-md border border-border p-2.5">
                    <label className="flex cursor-pointer items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="accountIds"
                          value={account.id}
                          checked={checked}
                          onChange={(event) =>
                            setSelectedAccounts((current) =>
                              event.target.checked ? [...current, account.id] : current.filter((id) => id !== account.id),
                            )
                          }
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{account.accountName}</span>
                        <span className="text-xs text-muted-foreground">{account.username}</span>
                      </span>
                      <Badge variant={account.platform === "instagram" ? "violet" : "info"}>{account.platform}</Badge>
                    </label>
                    {checked ? (
                      <div className="mt-2">
                        <Input
                          name={`caption_${account.id}`}
                          defaultValue={post?.targetCaptions?.[account.id] ?? ""}
                          placeholder="Optional caption override for this account"
                          className="h-8 text-xs"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="h-6 w-6 rounded-full bg-primary/10" />
                <span className="font-medium">{selectedAccounts.length > 0 ? "socialflow.demo" : "No account selected"}</span>
              </div>
              <div className="aspect-square bg-muted">
                {firstAsset?.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstAsset.publicUrl} alt={firstAsset.altText ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-sm">
                {caption || "Your caption will appear here."}
              </p>
            </div>
            {instagramSelected && selectedMedia.length === 0 ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Instagram needs at least one media item.
              </p>
            ) : null}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="intent" value={post?.id ? "save" : "draft"} variant="outline">
                  <Save className="h-4 w-4" /> Save draft
                </Button>
                {!post?.id ? (
                  <Button type="submit" name="intent" value="publish">
                    <Send className="h-4 w-4" /> Publish now
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="intent" value="approval" variant="outline">
                  Submit for approval
                </Button>
                <Button type="submit" name="intent" value="schedule" variant="outline">
                  <CalendarClock className="h-4 w-4" /> Schedule
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Admins and Managers can publish immediately. Executives submit for approval when the workspace requires it.
              </p>
            </div>
          </CardContent>
        </Card>
        <SubmitButton className="w-full xl:hidden" pendingText="Saving…">
          Save post
        </SubmitButton>
      </div>
    </form>
  );
}
