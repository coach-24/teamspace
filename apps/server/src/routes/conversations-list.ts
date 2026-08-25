import type { FastifyPluginAsync } from "fastify";

const conversationsListRoute: FastifyPluginAsync = async (
  app,
) => {
  app.get(
    "/api/conversations",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const authUserId = request.user?.id;

      if (!authUserId) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
          },
        });
      }

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

      const conversationResult =
        await app.db.query(
          `
          SELECT
            c.id,
            c.created_at,
            c.updated_at,
            other_user.id AS other_user_id,
            other_user.display_name AS other_user_display_name,
            other_user.email AS other_user_email,
            other_user.avatar_url AS other_user_avatar_url
          FROM conversations c
          INNER JOIN conversation_members current_member
            ON current_member.conversation_id = c.id
          INNER JOIN conversation_members other_member
            ON other_member.conversation_id = c.id
            AND other_member.user_id <> $1
          INNER JOIN users other_user
            ON other_user.id = other_member.user_id
          WHERE current_member.user_id = $1
          ORDER BY c.updated_at DESC
          `,
          [user.id],
        );

      return {
        data: conversationResult.rows,
      };
    },
  );
};

export default conversationsListRoute;