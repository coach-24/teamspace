import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  conversationId: z.uuid(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.uuid().optional(),
});

const conversationsMessagesListRoute: FastifyPluginAsync =
  async (app) => {
    app.get(
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
        // Validate query
        // ============================================

        const parsedQuery = querySchema.safeParse(
          request.query,
        );

        if (!parsedQuery.success) {
          return reply.status(400).send({
            error: {
              code: "INVALID_QUERY",
              message: "Invalid message query",
            },
          });
        }

        const { conversationId } =
          parsedParams.data;

        const { limit, before } =
          parsedQuery.data;

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
        // Fetch messages
        // ============================================

        const values: unknown[] = [
          conversationId,
        ];

        let whereClause =
          "dm.conversation_id = $1";

        if (before) {
          values.push(before);

          whereClause += `
            AND dm.created_at < (
              SELECT created_at
              FROM direct_messages
              WHERE id = $${values.length}
                AND conversation_id = $1
            )
          `;
        }

        values.push(limit);

        const limitIndex = values.length;

        const messagesResult =
          await app.db.query(
            `
            SELECT
              dm.id,
              dm.conversation_id,
              dm.sender_id,
              u.display_name AS sender_display_name,
              u.email AS sender_email,
              u.avatar_url AS sender_avatar_url,
              dm.content,
              dm.created_at,
              dm.updated_at
            FROM direct_messages dm
            INNER JOIN users u
              ON u.id = dm.sender_id
            WHERE ${whereClause}
            ORDER BY dm.created_at DESC
            LIMIT $${limitIndex}
            `,
            values,
          );

        return {
          data: messagesResult.rows.reverse(),
        };
      },
    );
  };

export default conversationsMessagesListRoute;