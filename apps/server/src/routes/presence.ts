import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { connectionManager } from "../realtime/connection-manager.js";

const paramsSchema = z.object({
  userId: z.uuid(),
});

const presenceRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/users/:userId/presence",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = paramsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_USER_ID",
            message: "User ID must be a valid UUID",
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

      const { userId } = parsed.data;

      // Resolve requesting TeamSpace user
      const requesterResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE auth_user_id = $1
        `,
        [authUserId],
      );

      const requester = requesterResult.rows[0];

      if (!requester) {
        return reply.status(403).send({
          error: {
            code: "USER_NOT_LINKED",
            message:
              "Authenticated user is not linked to a TeamSpace user",
          },
        });
      }

      // Find target user
      const userResult = await app.db.query(
        `
        SELECT
          id,
          display_name,
          email,
          last_seen_at
        FROM users
        WHERE id = $1
        `,
        [userId],
      );

      const user = userResult.rows[0];

      if (!user) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Presence is only visible to workspace colleagues.
      const membershipResult = await app.db.query(
        `
        SELECT 1
        FROM memberships m1
        INNER JOIN memberships m2
          ON m2.workspace_id = m1.workspace_id
        WHERE m1.user_id = $1
          AND m2.user_id = $2
        LIMIT 1
        `,
        [requester.id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "PRESENCE_ACCESS_DENIED",
            message:
              "You do not share a workspace with this user",
          },
        });
      }

      const connectionCount =
        connectionManager.getUserConnectionCount(
          user.id,
        );

      const online = connectionCount > 0;

      return {
        data: {
          user_id: user.id,
          display_name: user.display_name,
          status: online ? "online" : "offline",
          last_seen_at: online
            ? null
            : user.last_seen_at,
        },
      };
    },
  );
};

export default presenceRoute;