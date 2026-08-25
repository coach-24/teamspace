import type { FastifyPluginAsync } from "fastify";
import { connectionManager } from "../../realtime/connection-manager.js";
import { z } from "zod";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const createReplyRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/messages/:messageId/replies",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate input
      // ============================================

      const parsedParams = paramsSchema.safeParse(
        request.params,
      );

      const parsedBody = bodySchema.safeParse(
        request.body,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
          },
        });
      }

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REPLY",
            message:
              "Reply content must be between 1 and 4000 characters",
          },
        });
      }

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      const { messageId } = parsedParams.data;
      const { content } = parsedBody.data;

      // ============================================
      // Resolve user
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
      // Find root message
      // ============================================

      const messageResult = await app.db.query(
        `
        SELECT
          m.id,
          m.channel_id,
          m.parent_message_id,
          c.workspace_id,
          c.is_private
        FROM messages m
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE m.id = $1
        `,
        [messageId],
      );

      const parentMessage =
        messageResult.rows[0];

      if (!parentMessage) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found",
          },
        });
      }

      // ============================================
      // Always attach replies to root
      // ============================================

      const rootMessageId =
        parentMessage.parent_message_id ??
        parentMessage.id;

      // ============================================
      // Workspace membership
      // ============================================

      const membershipResult =
        await app.db.query(
          `
          SELECT id
          FROM memberships
          WHERE workspace_id = $1
            AND user_id = $2
          `,
          [
            parentMessage.workspace_id,
            user.id,
          ],
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

      if (parentMessage.is_private) {
        const channelMemberResult =
          await app.db.query(
            `
            SELECT id
            FROM channel_members
            WHERE channel_id = $1
              AND user_id = $2
            `,
            [
              parentMessage.channel_id,
              user.id,
            ],
          );

        if (
          channelMemberResult.rowCount === 0
        ) {
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
      // Create reply
      // ============================================

      const replyResult = await app.db.query(
        `
        INSERT INTO messages (
          channel_id,
          sender_id,
          content,
          parent_message_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          channel_id,
          sender_id,
          content,
          parent_message_id,
          created_at,
          updated_at
        `,
        [
          parentMessage.channel_id,
          user.id,
          content,
          rootMessageId,
        ],
      );

      const createdReply =
        replyResult.rows[0];

      // ============================================
      // Realtime
      // ============================================

      connectionManager.broadcastToChannel(
        parentMessage.channel_id,
        {
          type: "message.reply.created",
          data: createdReply,
        },
      );

      return reply.status(201).send({
        data: createdReply,
      });
    },
  );
};

export default createReplyRoute;