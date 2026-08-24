import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  channelId: z.uuid(),
});

const bodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const createMessageRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/channels/:channelId/messages",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsedParams = paramsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

      const parsedBody = bodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message content must be between 1 and 4000 characters",
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

      const { channelId } = parsedParams.data;
      const { content } = parsedBody.data;

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
      message: "Authenticated user is not linked to a TeamSpace user",
    },
  });
}

const userId = user.id;

      const channelResult = await app.db.query(
        `
        SELECT
          c.id,
          c.workspace_id
        FROM channels c
        WHERE c.id = $1
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

      const membershipResult = await app.db.query(
        `
        SELECT id
        FROM memberships
        WHERE workspace_id = $1
          AND user_id = $2
        `,
        [channel.workspace_id, userId],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message: "User is not a member of this workspace",
          },
        });
      }

      const messageResult = await app.db.query(
        `
        INSERT INTO messages (
          channel_id,
          sender_id,
          content
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          updated_at
        `,
        [channelId, userId, content],
      );

      return reply.status(201).send({
        data: messageResult.rows[0],
      });
    },
  );
};

export default createMessageRoute;