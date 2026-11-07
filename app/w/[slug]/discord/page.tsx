import { Bot, Link2, Play, Unplug } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { disconnectDiscordAction, testDiscordCommandAction, unlinkDiscordUserAction } from "@/lib/actions/discord";
import { formatDateTime, parseJson, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommandPermissionsForm, ConnectDiscordForm, DiscordSettingsForm, LinkDiscordForm } from "@/components/discord/discord-forms";

const COMMANDS = ["dashboard", "posts", "tasks", "publish-status", "approvals", "configure"];

export default async function DiscordPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_VIEW);
  const [integration, link, commands] = await Promise.all([
    db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id }, include: { connector: true } }),
    db.discordUserLink.findUnique({ where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: ctx.user.id } } }),
    db.discordCommand.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const canConfigure = ctx.can(PERMISSIONS.DISCORD_CONFIGURE);
  const notifications = parseJson<Record<string, boolean>>(integration?.notificationSettings ?? "{}", {});
  const commandPermissions = parseJson<Record<string, string[]>>(integration?.commandPermissions ?? "{}", {});
  const enabledCommands = commandPermissions.admin ?? COMMANDS;

  if (!integration) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Integrations" title="Discord" description="Run commands and receive notifications from Discord." />
        {canConfigure ? (
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" /> Connect a Discord server
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Add the SocialFlow bot to your server, choose channels and link your Discord account next.
              </p>
            </CardHeader>
            <CardContent>
              <ConnectDiscordForm slug={slug} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Bot}
            title="Discord is not connected"
            description="Ask an Admin to connect the SocialFlow bot to your server."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Integrations"
        title="Discord"
        description="Run commands and receive notifications from Discord. Commands are simulated in this build."
        actions={
          canConfigure ? (
            <form action={disconnectDiscordAction}>
              <input type="hidden" name="workspaceSlug" value={slug} />
              <Button type="submit" variant="outline">
                <Unplug className="h-4 w-4" /> Disconnect
              </Button>
            </form>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" /> Server
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted-foreground">
                Guild: <span className="text-foreground">{integration.guildName ?? "Unknown"}</span>
              </p>
              <p className="text-muted-foreground">
                Guild ID: <span className="text-foreground">{integration.discordGuildId}</span>
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Bot status: <StatusBadge status={integration.botStatus} />
              </div>
              <p className="text-muted-foreground">
                Connected by: <span className="text-foreground">{integration.connector.fullName}</span>
              </p>
              <p className="text-muted-foreground">
                Connected: <span className="text-foreground">{formatDateTime(integration.connectedAt)}</span>
              </p>
            </CardContent>
          </Card>

          {canConfigure ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channels & notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <DiscordSettingsForm
                  slug={slug}
                  integration={{
                    notificationChannelId: integration.notificationChannelId,
                    approvalsChannelId: integration.approvalsChannelId,
                    alertsChannelId: integration.alertsChannelId,
                    reportsChannelId: integration.reportsChannelId,
                  }}
                  notifications={notifications}
                />
              </CardContent>
            </Card>
          ) : null}

          {canConfigure ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Slash commands</CardTitle>
              </CardHeader>
              <CardContent>
                <CommandPermissionsForm slug={slug} selected={enabledCommands} />
              </CardContent>
            </Card>
          ) : null}

          {canConfigure ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Command execution history</CardTitle>
              </CardHeader>
              <CardContent>
                {commands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No commands have been run.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Command</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commands.map((command) => (
                        <TableRow key={command.id}>
                          <TableCell className="font-mono text-xs">/{command.command}</TableCell>
                          <TableCell className="text-xs">{command.user?.fullName ?? command.discordUserId}</TableCell>
                          <TableCell>
                            <StatusBadge status={command.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{relativeTime(command.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" /> Your Discord link
              </CardTitle>
              <p className="text-xs text-muted-foreground">Commands are only executed for linked Discord users.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <LinkDiscordForm slug={slug} link={link} />
              {link ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                  <span>
                    Linked as <span className="font-medium">{link.discordUsername ?? link.discordUserId}</span>
                  </span>
                  <form action={unlinkDiscordUserAction}>
                    <input type="hidden" name="workspaceSlug" value={slug} />
                    <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                      Unlink
                    </Button>
                  </form>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="h-4 w-4" /> Test a command
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={testDiscordCommandAction} className="space-y-2">
                <input type="hidden" name="workspaceSlug" value={slug} />
                <select name="command" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {COMMANDS.map((command) => (
                    <option key={command} value={command}>
                      /{command}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="w-full">
                  Simulate command
                </Button>
              </form>
              {!link ? <p className="mt-2 text-xs text-amber-600">Link your Discord user first or the command will be rejected.</p> : null}
            </CardContent>
          </Card>

          {canConfigure ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {(["admin", "manager", "executive"] as const).map((role) => (
                  <div key={role} className="rounded-md border border-border p-2">
                    <div className="mb-1 flex items-center gap-2 font-medium capitalize text-foreground">
                      {role} <Badge variant="outline">{(commandPermissions[role] ?? []).length} commands</Badge>
                    </div>
                    <p>{(commandPermissions[role] ?? []).map((command) => `/${command}`).join(" ") || "None"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
