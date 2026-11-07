import { db } from "./db";

type ActivityInput = {
  workspaceId: string;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "ai" | "discord";
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function logActivity(input: ActivityInput) {
  return db.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? "user",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
