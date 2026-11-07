import { AlertTriangle, Link2, RefreshCw, Unplug } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  disconnectAccountAction,
  reconnectAccountAction,
  setMockFailureAction,
  syncAccountAction,
} from "@/lib/actions/accounts";
import { formatDateTime, formatNumber, parseJson, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConnectAccountForm } from "@/components/accounts/connect-account-form";

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };

export default async function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_CONNECT);
  const accounts = await db.socialAccount.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { credentials: true, connector: true, _count: { select: { targets: true } } },
    orderBy: { connectedAt: "asc" },
  });
  const canConnect = ctx.can(PERMISSIONS.ACCOUNTS_CONNECT);
  const canManage = ctx.can(PERMISSIONS.ACCOUNTS_MANAGE);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Social accounts"
        description="Connect Instagram and Facebook accounts. This build uses mock OAuth and mock publishing."
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Meta is in <strong>mock mode</strong> (`META_MODE=mock`). No real API calls are made. Use the failure controls to exercise retries and
          partially-published states.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <EmptyState icon={Link2} title="No accounts connected" description="Connect an account to start publishing." />
          ) : (
            accounts.map((account) => {
              const metadata = parseJson<{ followers?: number; mockFailNext?: boolean; mockUncertainNext?: boolean }>(account.metadata, {});
              return (
                <Card key={account.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {account.accountName}
                        <Badge variant={account.status === "active" ? "success" : account.status === "disconnected" ? "danger" : "warning"}>
                          {account.status}
                        </Badge>
                      </CardTitle>
                      <Badge variant={account.platform === "instagram" ? "violet" : "info"}>{PLATFORM_LABEL[account.platform]}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="text-muted-foreground">
                        Username: <span className="text-foreground">{account.username ?? "—"}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Platform ID: <span className="text-foreground">{account.platformAccountId}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Followers: <span className="text-foreground">{formatNumber(metadata.followers ?? 0)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Targets: <span className="text-foreground">{account._count.targets}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Connected by: <span className="text-foreground">{account.connector.fullName}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Last synced: <span className="text-foreground">{account.lastSyncedAt ? relativeTime(account.lastSyncedAt) : "Never"}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Token expires:{" "}
                        <span className="text-foreground">{account.credentials?.expiresAt ? formatDateTime(account.credentials.expiresAt) : "—"}</span>
                      </p>
                    </div>

                    {metadata.mockFailNext || metadata.mockUncertainNext ? (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                        Armed: {metadata.mockFailNext ? "next publish will fail" : ""}
                        {metadata.mockFailNext && metadata.mockUncertainNext ? " · " : ""}
                        {metadata.mockUncertainNext ? "next publish will be uncertain" : ""}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      {canConnect ? (
                        <>
                          <form action={syncAccountAction}>
                            <input type="hidden" name="workspaceSlug" value={slug} />
                            <input type="hidden" name="accountId" value={account.id} />
                            <Button type="submit" size="sm" variant="outline">
                              <RefreshCw className="h-3.5 w-3.5" /> Sync
                            </Button>
                          </form>
                          {account.status !== "active" ? (
                            <form action={reconnectAccountAction}>
                              <input type="hidden" name="workspaceSlug" value={slug} />
                              <input type="hidden" name="accountId" value={account.id} />
                              <Button type="submit" size="sm">
                                Reconnect
                              </Button>
                            </form>
                          ) : null}
                        </>
                      ) : null}
                      {canManage ? (
                        <>
                          <form action={setMockFailureAction}>
                            <input type="hidden" name="workspaceSlug" value={slug} />
                            <input type="hidden" name="accountId" value={account.id} />
                            <input type="hidden" name="mode" value="fail" />
                            <Button type="submit" size="sm" variant="ghost" className="text-amber-600">
                              Arm failure
                            </Button>
                          </form>
                          <form action={setMockFailureAction}>
                            <input type="hidden" name="workspaceSlug" value={slug} />
                            <input type="hidden" name="accountId" value={account.id} />
                            <input type="hidden" name="mode" value="uncertain" />
                            <Button type="submit" size="sm" variant="ghost" className="text-violet-600">
                              Arm uncertain
                            </Button>
                          </form>
                          {account.status === "active" ? (
                            <form action={disconnectAccountAction}>
                              <input type="hidden" name="workspaceSlug" value={slug} />
                              <input type="hidden" name="accountId" value={account.id} />
                              <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                                <Unplug className="h-3.5 w-3.5" /> Disconnect
                              </Button>
                            </form>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {canConnect ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" /> Connect account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectAccountForm slug={slug} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
