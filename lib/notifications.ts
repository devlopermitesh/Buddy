import { db } from "./db";

type NotificationInput = {
  workspaceId: string;
  userId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  channel?: "in_app" | "discord" | "email";
};

export async function createNotification(input: NotificationInput) {
  return db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      type: input.type,
      channel: input.channel ?? "in_app",
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      sentAt: new Date(),
    },
  });
}
