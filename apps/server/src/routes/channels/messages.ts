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
      const parsedParams = channelParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

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