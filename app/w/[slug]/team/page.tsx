import { Check, Mail, Shield, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS, ROLES, ROLE_LABELS, can, type Role } from "@/lib/permissions";
import {
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  updateRolePermissionAction,
} from "@/lib/actions/team";
import { formatDate, parseJson, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteMemberForm, MemberRoleForm, OverrideSelect } from "@/components/team/team-forms";

const PERMISSION_LABELS: Record<string, string> = {
  "workspace.manage": "Manage workspace",
  "workspace.settings": "Workspace settings",
  "members.view": "View members",
  "members.invite": "Invite members",
  "members.manage": "Remove members",
  "roles.manage": "Manage roles & permissions",
  "accounts.connect": "Connect accounts",
  "accounts.manage": "Manage accounts",
  "posts.create": "Create & edit posts",
  "posts.schedule": "Schedule posts",
  "posts.approve": "Approve posts",
  "posts.publish": "Publish posts",
  "campaigns.manage": "Manage campaigns",
  "automation.manage": "Manage automation",
  "analytics.view": "View analytics",
  "reports.view": "View reports",
  "tasks.manage": "Manage tasks",
  "discord.configure": "Configure Discord",
  "discord.view": "View Discord",
  "auditlogs.view": "View activity logs",
  "settings.profile": "Edit profile",
  "ai.schedule": "Use AI scheduling",
  "media.manage": "Manage media",
  "notifications.manage": "Manage notifications",
};

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEMBERS_VIEW);
  const [members, invitations, rolePermissions] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id, status: { not: "removed" } },
      include: { user: true },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    db.invitation.findMany({
      where: { workspaceId: ctx.workspace.id, status: "pending" },
      include: { inviter: true },
      orderBy: { createdAt: "desc" },
    }),
    db.rolePermission.findMany({ where: { workspaceId: ctx.workspace.id } }),
  ]);

  const canInvite = ctx.can(PERMISSIONS.MEMBERS_INVITE);
  const canManageRoles = ctx.can(PERMISSIONS.ROLES_MANAGE);
  const canRemove = ctx.can(PERMISSIONS.MEMBERS_MANAGE);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Workspace" title="Team" description="Members, invitations and role-based permissions." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((member) => {
              const overrides = parseJson<Record<string, boolean>>(member.permissionOverrides, {});
              return (
                <div key={member.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{member.user.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.user.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                    <Badge variant={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
                    {canManageRoles ? (
                      <MemberRoleForm
                        slug={slug}
                        memberId={member.id}
                        role={member.role}
                        disabled={member.userId === ctx.workspace.ownerId}
                      />
                    ) : (
                      <Badge variant="outline">{ROLE_LABELS[member.role as Role] ?? member.role}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">joined {formatDate(member.joinedAt)}</span>
                    {canRemove && member.userId !== ctx.workspace.ownerId ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="memberId" value={member.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Remove member">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  {canManageRoles ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Permission overrides ({Object.keys(overrides).length})
                      </summary>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {ALL_PERMISSIONS.map((permission) => (
                          <div key={permission} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                            <span className="text-[11px] text-muted-foreground">{PERMISSION_LABELS[permission] ?? permission}</span>
                            <OverrideSelect
                              slug={slug}
                              memberId={member.id}
                              permission={permission}
                              value={overrides[permission] === true ? "allow" : overrides[permission] === false ? "deny" : "inherit"}
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canInvite ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" /> Invite a teammate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InviteMemberForm slug={slug} inviterRole={ctx.role} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending invitations ({invitations.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                invitations.map((invitation) => (
                  <div key={invitation.id} className="space-y-2 rounded-md border border-border p-2.5 text-sm">
                    <div>
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[invitation.role as Role] ?? invitation.role} · invited by {invitation.inviter.fullName}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <form action={resendInvitationAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Resend
                        </Button>
                      </form>
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                          Revoke
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {canManageRoles ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Roles & permissions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Role defaults apply to every member. Individual overrides above take precedence.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  {ROLES.map((role) => (
                    <TableHead key={role} className="text-center">
                      {ROLE_LABELS[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_PERMISSIONS.map((permission) => (
                  <TableRow key={permission}>
                    <TableCell className="text-sm">{PERMISSION_LABELS[permission] ?? titleCase(permission.split(".").pop() ?? permission)}</TableCell>
                    {ROLES.map((role) => {
                      const allowed = can(role, permission, {}, rolePermissions);
                      return (
                        <TableCell key={role} className="text-center">
                          <form action={updateRolePermissionAction} className="inline">
                            <input type="hidden" name="workspaceSlug" value={slug} />
                            <input type="hidden" name="role" value={role} />
                            <input type="hidden" name="permission" value={permission} />
                            <input type="hidden" name="allowed" value={allowed ? "false" : "true"} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${allowed ? "text-emerald-600" : "text-muted-foreground/40"}`}
                              aria-label={`${allowed ? "Deny" : "Allow"} ${permission} for ${role}`}
                            >
                              {allowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </Button>
                          </form>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
