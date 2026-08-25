import type { FastifyPluginAsync } from "fastify";
import { connectionManager } from "../../realtime/connection-manager.js";
import { z } from "zod";

const paramsSchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid(),
});

const markDirectMessageReadRoute: FastifyPluginAsync =
  async (app) => {
    app.post(
      "/api/conversations/:conversationId/messages/:messageId/read",
      { config: { requiresAuth: true } },
      async (request, reply) => {
        // ============================================
        // Validate parameters
        // ============================================

        const parsedParams = paramsSchema.safeParse(
          request.params,
        );

        if (!parsedParams.success) {
          return reply.status(400).send({
            error: {
              code: "INVALID_PARAMETERS",
              message:
                "Conversation ID and message ID must be valid UUIDs",
            },
          });
        }

        const {
          conversationId,
          messageId,
        } = parsedParams.data;

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
        // Verify message belongs to conversation
        // ============================================

        const messageResult =
          await app.db.query(
            `
            SELECT
              id,
              conversation_id,
              sender_id
            FROM direct_messages
            WHERE id = $1
              AND conversation_id = $2
            `,
            [
              messageId,
              conversationId,
            ],
          );

        const message =
          messageResult.rows[0];

        if (!message) {
          return reply.status(404).send({
            error: {
              code: "MESSAGE_NOT_FOUND",
              message: "Message not found",
            },
          });
        }

        // ============================================
        // Mark message as read
        // ============================================

        const receiptResult =
          await app.db.query(
            `
            INSERT INTO direct_message_read_receipts (
              message_id,
              user_id,
              read_at
            )
            VALUES ($1, $2, NOW())
            ON CONFLICT (
              message_id,
              user_id
            )
            DO UPDATE SET
              read_at = NOW()
            RETURNING
              id,
              message_id,
              user_id,
              read_at
            `,
            [
              messageId,
              user.id,
            ],
          );

        const receipt =
          receiptResult.rows[0];

        // ============================================
// Notify message sender
// ============================================

if (message.sender_id !== user.id) {
  connectionManager.broadcastToUser(
    message.sender_id,
    {
      type: "direct_message.read",
      data: {
        messageId: message.id,
        conversationId: message.conversation_id,
        userId: user.id,
        readAt: receipt.read_at,
      },
    },
  );
}
        return reply.status(200).send({
          data: receipt,
        });
      },
    );
  };

export default markDirectMessageReadRoute;