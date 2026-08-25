import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime().optional(),
});

const repliesRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/messages/:messageId/replies",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsedParams = paramsSchema.safeParse(
        request.params,
      );

      const parsedQuery = querySchema.safeParse(
        request.query,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
          },
        });
      }

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REPLY_QUERY",
            message:
              "Invalid reply query parameters",
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
      const { limit, before } =
        parsedQuery.data;

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
      // Find message + channel
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
            message.workspace_id,
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

      if (message.is_private) {
        const channelMemberResult =
          await app.db.query(
            `
            SELECT id
            FROM channel_members
            WHERE channel_id = $1
              AND user_id = $2
            `,
            [
              message.channel_id,
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
      // Resolve root
      // ============================================

      const rootMessageId =
        message.parent_message_id ??
        message.id;

      // ============================================
      // Fetch replies
      // ============================================

      const result = await app.db.query(
        `
        SELECT
          m.id,
          m.channel_id,
          m.sender_id,
          u.display_name AS sender_name,
          u.avatar_url AS sender_avatar_url,
          m.content,
          m.parent_message_id,
          m.created_at,
          m.updated_at
        FROM messages m
        INNER JOIN users u
          ON u.id = m.sender_id
        WHERE m.parent_message_id = $1
          AND (
            $2::timestamptz IS NULL
            OR m.created_at < $2
          )
        ORDER BY m.created_at ASC
        LIMIT $3
        `,
        [
          rootMessageId,
          before ?? null,
          limit,
        ],
      );

      return {
        data: result.rows,
        pagination: {
          limit,
          before: before ?? null,
          hasMore: result.rows.length === limit,
        },
      };
    },
  );
};

export default repliesRoute;