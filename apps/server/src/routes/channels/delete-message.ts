import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { connectionManager } from "../../realtime/connection-manager.js";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const deleteMessageRoute: FastifyPluginAsync = async (app) => {
  app.delete(
    "/api/messages/:messageId",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate parameters
      // ============================================

      const parsedParams = paramsSchema.safeParse(request.params);

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
          m.sender_id,
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
      // Message ownership
      // ============================================

      if (message.sender_id !== user.id) {
        return reply.status(403).send({
          error: {
            code: "MESSAGE_DELETE_DENIED",
            message: "You can only delete your own messages",
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
            message: "User is not a member of this workspace",
          },
        });
      }

      // ============================================
      // Private channel authorization
      // ============================================

      if (message.is_private) {
        const channelMemberResult = await app.db.query(
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
      // Delete message
      // ============================================

      await app.db.query(
    `
    DELETE FROM messages
    WHERE id = $1
    `,
    [messageId],
    );

    connectionManager.broadcastToChannel(
    message.channel_id,
    {
        type: "message.deleted",
        data: {
        id: message.id,
        channel_id: message.channel_id,
        },
    },
    );

    return reply.status(204).send();
    },
  );
};

export default deleteMessageRoute;