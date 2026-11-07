import Link from "next/link";
import { FileBarChart, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteReportAction } from "@/lib/actions/reports";
import type { ReportData } from "@/lib/actions/reports";
import { formatDate, formatDateTime, formatNumber, parseJson, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportForm } from "@/components/reports/report-form";

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.REPORTS_VIEW);
  const reports = await db.report.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Generate a shareable performance summary for any period. Reports are stored with the numbers at generation time."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {reports.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No reports yet" description="Generate your first weekly or monthly summary." />
          ) : (
            reports.map((report) => {
              const data = parseJson<ReportData | null>(report.data, null);
              return (
                <Card key={report.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        <Link href={`/w/${slug}/reports/${report.id}`} className="hover:underline">
                          {titleCase(report.type)} report
                        </Link>
                      </CardTitle>
                      <Badge variant="outline">
                        {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Reach</p>
                        <p className="font-medium">{formatNumber(data?.totals?.reach ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                        <p className="font-medium">{formatNumber(data?.totals?.impressions ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Engagements</p>
                        <p className="font-medium">{formatNumber(data?.totals?.engagement ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Posts</p>
                        <p className="font-medium">{data?.totals?.posts ?? 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground">Generated {formatDateTime(report.createdAt)}</p>
                      <div className="flex gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/w/${slug}/reports/${report.id}`}>View</Link>
                        </Button>
                        <form action={deleteReportAction}>
                          <input type="hidden" name="workspaceSlug" value={slug} />
                          <input type="hidden" name="reportId" value={report.id} />
                          <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Delete report">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Generate report</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportForm slug={slug} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
