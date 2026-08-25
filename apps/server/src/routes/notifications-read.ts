import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  notificationId: z.uuid(),
});

const notificationsReadRoute: FastifyPluginAsync = async (
  app,
) => {
  app.patch(
    "/api/notifications/:notificationId/read",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate notification ID
      // ============================================

      const parsedParams = paramsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_NOTIFICATION_ID",
            message:
              "Notification ID must be a valid UUID",
          },
        });
      }

      const { notificationId } =
        parsedParams.data;

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
      // Mark notification as read
      // ============================================

      const notificationResult =
        await app.db.query(
          `
          UPDATE notifications
          SET
            is_read = true,
            read_at = COALESCE(read_at, NOW())
          WHERE id = $1
            AND user_id = $2
          RETURNING
            id,
            user_id,
            type,
            message_id,
            channel_id,
            actor_id,
            data,
            is_read,
            created_at,
            read_at
          `,
          [
            notificationId,
            user.id,
          ],
        );

      const notification =
        notificationResult.rows[0];

      if (!notification) {
        return reply.status(404).send({
          error: {
            code: "NOTIFICATION_NOT_FOUND",
            message: "Notification not found",
          },
        });
      }

      return {
        data: notification,
      };
    },
  );
};

export default notificationsReadRoute;