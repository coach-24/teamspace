import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const searchUsersRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/search/users",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_SEARCH_QUERY",
            message:
              "Search query must contain 1-100 characters",
          },
        });
      }

      const { q, limit } = parsed.data;

      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

      const currentUserResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [authUserId],
      );

      const currentUser =
        currentUserResult.rows[0];

      if (!currentUser) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message:
              "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      const result = await app.db.query(
        `
        SELECT DISTINCT
          u.id,
          u.display_name,
          u.email,
          u.avatar_url
        FROM users u
        INNER JOIN memberships m
          ON m.user_id = u.id
        WHERE m.workspace_id IN (
          SELECT workspace_id
          FROM memberships
          WHERE user_id = $1
        )
        AND u.id <> $1
        AND (
          u.display_name ILIKE '%' || $2 || '%'
          OR u.email ILIKE '%' || $2 || '%'
        )
        ORDER BY
          u.display_name ASC
        LIMIT $3
        `,
        [
          currentUser.id,
          q,
          limit,
        ],
      );

      return {
        data: result.rows,
        meta: {
          query: q,
          count: result.rows.length,
        },
      };
    },
  );
};

export default searchUsersRoute;