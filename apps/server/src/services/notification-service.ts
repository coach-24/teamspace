import type { Pool } from "pg";
import { connectionManager } from "../realtime/connection-manager.js";

type CreateNotificationInput = {
  userId: string;
  type: string;
  messageId?: string;
  channelId?: string;
  actorId?: string;
  data?: Record<string, unknown>;
};

export const createNotification = async (
  db: Pool,
  input: CreateNotificationInput,
) => {
  const result = await db.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      message_id,
      channel_id,
      actor_id,
      data
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      user_id,
      type,
      message_id,
      channel_id,
      actor_id,
      data,
      is_read,
      created_at,
      read_at
    `,
    [
      input.userId,
      input.type,
      input.messageId ?? null,
      input.channelId ?? null,
      input.actorId ?? null,
      JSON.stringify(input.data ?? {}),
    ],
  );

  const notification = result.rows[0];

  connectionManager.broadcastToUser(
    input.userId,
    {
      type: "notification.created",
      data: notification,
    },
  );

  return notification;
};