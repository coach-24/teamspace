import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime().optional(),
});

const channelParamsSchema = z.object({
  channelId: z.uuid(),
});

const messagesRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/channels/:channelId/messages",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate channel ID
      // ============================================

      const parsedParams = channelParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

      // ============================================
      // Validate query
      // ============================================

      const parsedQuery = messagesQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_QUERY",
            message: "Invalid message query parameters",
          },
        });
      }

      const { channelId } = parsedParams.data;
      const { limit, before } = parsedQuery.data;

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
      // Find channel
      // ============================================

      const channelResult = await app.db.query(
        `
        SELECT
          id,
          workspace_id,
          is_private
        FROM channels
        WHERE id = $1
        `,
        [channelId],
      );

      const channel = channelResult.rows[0];

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: "CHANNEL_NOT_FOUND",
            message: "Channel not found",
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
        [channel.workspace_id, user.id],
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

      if (channel.is_private) {
        const channelMemberResult = await app.db.query(
          `
          SELECT id
          FROM channel_members
          WHERE channel_id = $1
            AND user_id = $2
          `,
          [channelId, user.id],
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
      // Fetch messages
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
          m.created_at,
          m.updated_at
        FROM messages m
        INNER JOIN users u
          ON u.id = m.sender_id
        WHERE m.channel_id = $1
          AND ($2::timestamptz IS NULL OR m.created_at < $2)
        ORDER BY m.created_at DESC
        LIMIT $3
        `,
        [channelId, before ?? null, limit],
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

export default messagesRoute;