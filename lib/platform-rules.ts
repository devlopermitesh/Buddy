import type { Post, PostTarget } from "@prisma/client";

export type PlatformValidationInput = {
  platform: string;
  caption: string;
  mediaCount: number;
  format: string;
  mediaTypes?: string[];
};

export function validateForPlatform(input: PlatformValidationInput): string[] {
  const errors: string[] = [];
  const caption = input.caption ?? "";

  if (input.platform === "instagram") {
    if (input.mediaCount === 0) errors.push("Instagram requires at least one image or video.");
    if (caption.length > 2200) errors.push("Instagram captions are limited to 2,200 characters.");
    const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (hashtags.length > 30) errors.push("Instagram allows a maximum of 30 hashtags.");
    if (input.format === "carousel" && (input.mediaCount < 2 || input.mediaCount > 10)) {
      errors.push("Instagram carousels require between 2 and 10 media items.");
    }
    if (input.format === "text") errors.push("Instagram does not support text-only posts.");
  }

  if (input.platform === "facebook") {
    if (caption.length > 63206) errors.push("Facebook captions are limited to 63,206 characters.");
  }

  if (!["instagram", "facebook"].includes(input.platform)) {
    errors.push(`Unsupported platform: ${input.platform}`);
  }

  return errors;
}

export function derivePostStatus(
  targets: Pick<PostTarget, "status">[],
  current?: Pick<Post, "status">,
): string {
  if (targets.length === 0) return current?.status ?? "draft";
  const statuses = targets.map((t) => t.status);
  if (statuses.every((s) => s === "published")) return "published";
  if (statuses.some((s) => s === "published") && statuses.some((s) => s === "failed")) return "partially_published";
  if (statuses.some((s) => s === "published")) return "partially_published";
  if (statuses.some((s) => s === "publishing")) return "publishing";
  if (statuses.some((s) => s === "queued")) return "queued";
  if (statuses.some((s) => s === "scheduled")) return "scheduled";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.some((s) => s === "draft")) return current?.status === "pending_approval" ? "pending_approval" : "draft";
  return current?.status ?? "draft";
}

export function countHashtags(caption: string) {
  return (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}
