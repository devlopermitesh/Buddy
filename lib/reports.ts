import { parseJson } from "./utils";
import type { ReportData, ReportTotals } from "./actions/reports";

type LegacySummary = {
  impressions?: number;
  reach?: number;
  engagementRate?: number;
  followersGained?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reports store a snapshot of their numbers as JSON at generation time. Older
 * snapshots used a `summary`/`topPosts` shape before the current
 * `totals`/`byPlatform` shape existed, so normalise both here. Pages can then
 * render any report without crashing or showing blank metrics.
 */
export function parseReportData(raw: string | null | undefined): ReportData | null {
  const parsed = parseJson<Record<string, unknown> | null>(raw ?? null, null);
  if (!parsed) return null;

  const totalsSource = isRecord(parsed.totals) ? parsed.totals : {};
  const summary = (isRecord(parsed.summary) ? parsed.summary : {}) as LegacySummary;
  const impressions = num(totalsSource.impressions, num(summary.impressions));
  const engagementRate = num(summary.engagementRate);

  const totals: ReportTotals = {
    posts: num(totalsSource.posts),
    impressions,
    reach: num(totalsSource.reach, num(summary.reach)),
    likes: num(totalsSource.likes),
    comments: num(totalsSource.comments),
    shares: num(totalsSource.shares),
    saves: num(totalsSource.saves),
    clicks: num(totalsSource.clicks),
    videoViews: num(totalsSource.videoViews),
    engagement: num(
      totalsSource.engagement,
      impressions > 0 && engagementRate > 0 ? Math.round((impressions * engagementRate) / 100) : 0,
    ),
  };

  const byPlatform = Array.isArray(parsed.byPlatform)
    ? parsed.byPlatform.filter(isRecord).map((row) => ({
        platform: str(row.platform) ?? "unknown",
        posts: num(row.posts),
        impressions: num(row.impressions),
        reach: num(row.reach),
        likes: num(row.likes),
        comments: num(row.comments),
        shares: num(row.shares),
        saves: num(row.saves),
        clicks: num(row.clicks),
        videoViews: num(row.videoViews),
        engagement: num(row.engagement),
      }))
    : [];

  const topPosts = Array.isArray(parsed.topPosts)
    ? parsed.topPosts.filter(isRecord).map((post) => ({
        postId: str(post.postId) ?? "",
        title: str(post.title) ?? "Untitled post",
        platform: str(post.platform) ?? "all",
        reach: num(post.reach, num(post.impressions)),
        engagement: num(post.engagement, num(post.likes)),
      }))
    : [];

  return {
    type: str(parsed.type) ?? "custom",
    periodStart: str(parsed.periodStart) ?? "",
    periodEnd: str(parsed.periodEnd) ?? "",
    generatedAt: str(parsed.generatedAt) ?? "",
    totals,
    byPlatform,
    topPosts,
  };
}
