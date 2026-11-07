import { ScrollText, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime, parseJson, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ActivityLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; entity?: string; actor?: string }>;
}) {
  const { slug } = await params;
  const { q, entity, actor } = await searchParams;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUDITLOGS_VIEW);

  const [logs, entityTypes, members] = await Promise.all([
    db.activityLog.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...(entity ? { entityType: entity } : {}),
        ...(actor ? { actorUserId: actor } : {}),
        ...(q ? { OR: [{ action: { contains: q } }, { entityId: { contains: q } }, { metadata: { contains: q } }] } : {}),
      },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    db.activityLog.findMany({ where: { workspaceId: ctx.workspace.id }, distinct: ["entityType"], select: { entityType: true } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id }, include: { user: true } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin" title="Activity logs" description="An append-only audit trail of workspace actions." />

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
          <form className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q ?? ""} placeholder="Search action, entity id or metadata…" className="pl-8" />
          </form>
          <form className="flex flex-wrap gap-2">
            <select name="entity" defaultValue={entity ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All entities</option>
              {entityTypes.map((entry) => (
                <option key={entry.entityType} value={entry.entityType}>
                  {titleCase(entry.entityType.replaceAll("_", " "))}
                </option>
              ))}
            </select>
            <select name="actor" defaultValue={actor ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All actors</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.fullName}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              Filter
            </button>
          </form>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No matching activity" description="Try clearing the filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const metadata = parseJson<Record<string, unknown>>(log.metadata ?? "{}", {});
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      {log.actor?.fullName ?? <span className="text-muted-foreground">{titleCase(log.actorType)}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">{log.entityType}</span>
                      {log.entityId ? <span className="block font-mono text-[10px] text-muted-foreground">{log.entityId.slice(0, 8)}…</span> : null}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {Object.keys(metadata).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer">View metadata</summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-1.5 text-[10px]">{JSON.stringify(metadata, null, 2)}</pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
