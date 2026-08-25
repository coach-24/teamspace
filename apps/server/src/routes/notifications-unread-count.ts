import type { FastifyPluginAsync } from "fastify";

const notificationsUnreadCountRoute: FastifyPluginAsync =
  async (app) => {
    app.get(
      "/api/notifications/unread-count",
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
        // Count unread notifications
        // ============================================

        const result = await app.db.query(
          `
          SELECT COUNT(*)::int AS count
          FROM notifications
          WHERE user_id = $1
            AND is_read = false
          `,
          [user.id],
        );

        return {
          data: {
            count: result.rows[0].count,
          },
        };
      },
    );
  };

export default notificationsUnreadCountRoute;