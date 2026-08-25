import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

const searchMessagesRoute: FastifyPluginAsync =
  async (app) => {
    app.get(
      "/api/search/messages",
      { config: { requiresAuth: true } },
      async (request, reply) => {
        // ============================================
        // Validate query
        // ============================================

        const parsedQuery = querySchema.safeParse(
          request.query,
        );

        if (!parsedQuery.success) {
          return reply.status(400).send({
            error: {
              code: "INVALID_SEARCH_QUERY",
              message:
                "Search query must contain 1-100 characters",
            },
          });
        }

        const { q, limit } = parsedQuery.data;

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
        // Search accessible channel messages
        // ============================================

        const channelMessagesResult =
          await app.db.query(
            `
            SELECT
              m.id,
              'channel' AS source,
              m.channel_id,
              NULL::uuid AS conversation_id,
              m.sender_id,
              u.display_name AS sender_display_name,
              u.email AS sender_email,
              m.content,
              m.created_at,
              m.updated_at
            FROM messages m
            INNER JOIN users u
              ON u.id = m.sender_id
            INNER JOIN channels c
              ON c.id = m.channel_id
            INNER JOIN memberships membership
              ON membership.workspace_id = c.workspace_id
              AND membership.user_id = $1
            WHERE
              m.content ILIKE '%' || $2 || '%'
              AND (
                c.is_private = FALSE
                OR EXISTS (
                  SELECT 1
                  FROM channel_members cm
                  WHERE cm.channel_id = c.id
                    AND cm.user_id = $1
                )
              )
            ORDER BY m.created_at DESC
            LIMIT $3
            `,
            [
              user.id,
              q,
              limit,
            ],
          );

        // ============================================
        // Search accessible direct messages
        // ============================================

        const directMessagesResult =
          await app.db.query(
            `
            SELECT
              dm.id,
              'direct' AS source,
              NULL::uuid AS channel_id,
              dm.conversation_id,
              dm.sender_id,
              u.display_name AS sender_display_name,
              u.email AS sender_email,
              dm.content,
              dm.created_at,
              dm.updated_at
            FROM direct_messages dm
            INNER JOIN users u
              ON u.id = dm.sender_id
            INNER JOIN conversation_members cm
              ON cm.conversation_id = dm.conversation_id
              AND cm.user_id = $1
            WHERE dm.content ILIKE '%' || $2 || '%'
            ORDER BY dm.created_at DESC
            LIMIT $3
            `,
            [
              user.id,
              q,
              limit,
            ],
          );

        // ============================================
        // Combine and sort results
        // ============================================

        const results = [
          ...channelMessagesResult.rows,
          ...directMessagesResult.rows,
        ]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .slice(0, limit);

        return {
          data: results,
          meta: {
            query: q,
            count: results.length,
          },
        };
      },
    );
  };

export default searchMessagesRoute;