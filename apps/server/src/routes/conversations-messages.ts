import type { FastifyPluginAsync } from "fastify";
import { connectionManager } from "../realtime/connection-manager.js";
import { z } from "zod";

const paramsSchema = z.object({
  conversationId: z.uuid(),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const conversationsMessagesRoute: FastifyPluginAsync =
  async (app) => {
    app.post(
      "/api/conversations/:conversationId/messages",
      { config: { requiresAuth: true } },
      async (request, reply) => {
        // ============================================
        // Validate params
        // ============================================

        const parsedParams = paramsSchema.safeParse(
          request.params,
        );

        if (!parsedParams.success) {
          return reply.status(400).send({
            error: {
              code: "INVALID_CONVERSATION_ID",
              message:
                "Conversation ID must be a valid UUID",
            },
          });
        }

        // ============================================
        // Validate body
        // ============================================

        const parsedBody = bodySchema.safeParse(
          request.body,
        );

        if (!parsedBody.success) {
          return reply.status(400).send({
            error: {
              code: "INVALID_MESSAGE",
              message:
                "Message content must be between 1 and 4000 characters",
            },
          });
        }

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

        const { conversationId } =
          parsedParams.data;

        const { content } =
          parsedBody.data;

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
        // Verify conversation exists
        // ============================================

        const conversationResult =
          await app.db.query(
            `
            SELECT
              id
            FROM conversations
            WHERE id = $1
            `,
            [conversationId],
          );

        const conversation =
          conversationResult.rows[0];

        if (!conversation) {
          return reply.status(404).send({
            error: {
              code: "CONVERSATION_NOT_FOUND",
              message: "Conversation not found",
            },
          });
        }

        // ============================================
        // Verify conversation membership
        // ============================================

        const membershipResult =
          await app.db.query(
            `
            SELECT id
            FROM conversation_members
            WHERE conversation_id = $1
              AND user_id = $2
            `,
            [
              conversationId,
              user.id,
            ],
          );

        if (membershipResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CONVERSATION_ACCESS_DENIED",
              message:
                "You do not have access to this conversation",
            },
          });
        }

        // ============================================
        // Create DM message
        // ============================================

        const messageResult =
          await app.db.query(
            `
            INSERT INTO direct_messages (
              conversation_id,
              sender_id,
              content
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              conversation_id,
              sender_id,
              content,
              created_at,
              updated_at
            `,
            [
              conversationId,
              user.id,
              content,
            ],
          );

        const message =
          messageResult.rows[0];

        // ============================================
        // Update conversation timestamp
        // ============================================

        await app.db.query(
          `
          UPDATE conversations
          SET updated_at = NOW()
          WHERE id = $1
          `,
          [conversationId],
        );

        // ============================================
// Find other conversation member
// ============================================

const recipientResult = await app.db.query(
  `
  SELECT user_id
  FROM conversation_members
  WHERE conversation_id = $1
    AND user_id <> $2
  `,
  [conversationId, user.id],
);

const recipient = recipientResult.rows[0];

if (recipient) {
  connectionManager.broadcastToUser(
    recipient.user_id,
    {
      type: "direct_message.created",
      data: message,
    },
  );
}

        return reply.status(201).send({
          data: message,
        });
      },
    );
  };

export default conversationsMessagesRoute;