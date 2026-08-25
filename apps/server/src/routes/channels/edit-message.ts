import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const editMessageRoute: FastifyPluginAsync = async (app) => {
  app.patch(
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

      // ============================================
      // Validate body
      // ============================================

      const parsedBody = bodySchema.safeParse(request.body);

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

      const { messageId } = parsedParams.data;
      const { content } = parsedBody.data;

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
      // Find message
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
            code: "MESSAGE_EDIT_DENIED",
            message: "You can only edit your own messages",
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
      // Update message
      // ============================================

      const updatedMessageResult = await app.db.query(
        `
        UPDATE messages
        SET
          content = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          updated_at
        `,
        [content, messageId],
      );

      return {
        data: updatedMessageResult.rows[0],
      };
    },
  );
};

export default editMessageRoute;