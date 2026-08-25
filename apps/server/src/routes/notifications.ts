import type { FastifyPluginAsync } from "fastify";

const notificationsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/notifications",
    { config: { requiresAuth: true } },
    async (request, reply) => {
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
      // Fetch notifications
      // ============================================

      const notificationResult =
        await app.db.query(
          `
          SELECT
            n.id,
            n.user_id,
            n.type,
            n.message_id,
            n.channel_id,
            n.actor_id,
            n.data,
            n.is_read,
            n.created_at,
            n.read_at,
            actor.display_name AS actor_display_name
          FROM notifications n
          LEFT JOIN users actor
            ON actor.id = n.actor_id
          WHERE n.user_id = $1
          ORDER BY n.created_at DESC
          LIMIT 50
          `,
          [user.id],
        );

      return {
        data: notificationResult.rows,
      };
    },
  );
};

export default notificationsRoute;