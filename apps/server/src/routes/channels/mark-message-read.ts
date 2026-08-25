import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const markMessageReadRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/messages/:messageId/read",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate message ID
      // ============================================

      const parsedParams = paramsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
          },
        });
      }

      const { messageId } = parsedParams.data;

      // ============================================
      // Authentication
      // ============================================

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      // ============================================
      // Resolve TeamSpace user
      // ============================================

      const userResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [authUserId],
      );

      const user = userResult.rows[0];

      if (!user) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message:
              "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      // ============================================
      // Find message + channel
      // ============================================

      const messageResult = await app.db.query(
        `
        SELECT
          m.id,
          m.channel_id,
          c.workspace_id,
          c.is_private
        FROM messages m
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE m.id = $1
        `,
        [messageId],
      );

      const message = messageResult.rows[0];

      if (!message) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found",
          },
        });
      }

      // ============================================
      // Workspace membership
      // ============================================

      const membershipResult = await app.db.query(
        `
        SELECT id
        FROM memberships
        WHERE workspace_id = $1
          AND user_id = $2
        `,
        [message.workspace_id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message:
              "User is not a member of this workspace",
          },
        });
      }

      // ============================================
      // Private channel authorization
      // ============================================

      if (message.is_private) {
        const channelMemberResult =
          await app.db.query(
            `
            SELECT id
            FROM channel_members
            WHERE channel_id = $1
              AND user_id = $2
            `,
            [message.channel_id, user.id],
          );

        if (channelMemberResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CHANNEL_ACCESS_DENIED",
              message:
                "You do not have access to this private channel",
            },
          });
        }
      }

      // ============================================
      // Create/update read receipt
      // ============================================

      const receiptResult = await app.db.query(
        `
        INSERT INTO message_read_receipts (
          message_id,
          user_id,
          read_at
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (message_id, user_id)
        DO UPDATE SET
          read_at = NOW()
        RETURNING
          id,
          message_id,
          user_id,
          read_at
        `,
        [messageId, user.id],
      );

      return {
        data: receiptResult.rows[0],
      };
    },
  );
};

export default markMessageReadRoute;