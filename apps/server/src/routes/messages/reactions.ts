import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { connectionManager } from "../../realtime/connection-manager.js";

const paramsSchema = z.object({
  messageId: z.uuid(),
});

const bodySchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});

const reactionsRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/messages/:messageId/reactions",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const body = bodySchema.safeParse(request.body);

      if (!params.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
          },
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REACTION",
            message: "Emoji must contain 1-32 characters",
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

      const { messageId } = params.data;
      const { emoji } = body.data;

      const userResult = await app.db.query(
        `
        SELECT id, display_name, email
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

      const messageResult = await app.db.query(
        `
        SELECT
          m.id,
          m.channel_id,
          c.workspace_id,
          c.is_private
        FROM messages m
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE m.id = $1
        `,
        [messageId],
      );

      const message = messageResult.rows[0];

      if (!message) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found",
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
        [message.workspace_id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message:
              "User is not a member of this workspace",
          },
        });
      }

      if (message.is_private) {
        const channelMemberResult = await app.db.query(
          `
          SELECT id
          FROM channel_members
          WHERE channel_id = $1
            AND user_id = $2
          `,
          [message.channel_id, user.id],
        );

        if (channelMemberResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CHANNEL_ACCESS_DENIED",
              message:
                "You do not have access to this private channel",
            },
          });
        }
      }

      try {
        const reactionResult = await app.db.query(
          `
          INSERT INTO message_reactions (
            message_id,
            user_id,
            emoji
          )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            message_id,
            user_id,
            emoji,
            created_at
          `,
          [messageId, user.id, emoji],
        );

        const reaction = reactionResult.rows[0];

        connectionManager.broadcastToChannel(
          message.channel_id,
          {
            type: "reaction.added",
            data: {
              ...reaction,
              user: {
                id: user.id,
                display_name: user.display_name,
                email: user.email,
              },
            },
          },
        );

        return reply.status(201).send({
          data: reaction,
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          return reply.status(409).send({
            error: {
              code: "REACTION_ALREADY_EXISTS",
              message:
                "You have already added this reaction",
            },
          });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/api/messages/:messageId/reactions/:emoji",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const params = z
        .object({
          messageId: z.uuid(),
          emoji: z.string().min(1).max(32),
        })
        .safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REACTION",
            message: "Invalid message ID or emoji",
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

      const { messageId, emoji } = params.data;

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

      const messageResult = await app.db.query(
        `
        SELECT
          m.channel_id,
          c.workspace_id,
          c.is_private
        FROM messages m
        INNER JOIN channels c
          ON c.id = m.channel_id
        WHERE m.id = $1
        `,
        [messageId],
      );

      const message = messageResult.rows[0];

      if (!message) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found",
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
        [message.workspace_id, user.id],
      );

      if (membershipResult.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: "NOT_WORKSPACE_MEMBER",
            message:
              "User is not a member of this workspace",
          },
        });
      }

      if (message.is_private) {
        const channelMemberResult = await app.db.query(
          `
          SELECT id
          FROM channel_members
          WHERE channel_id = $1
            AND user_id = $2
          `,
          [message.channel_id, user.id],
        );

        if (channelMemberResult.rowCount === 0) {
          return reply.status(403).send({
            error: {
              code: "CHANNEL_ACCESS_DENIED",
              message:
                "You do not have access to this private channel",
            },
          });
        }
      }

      const deletedResult = await app.db.query(
        `
        DELETE FROM message_reactions
        WHERE message_id = $1
          AND user_id = $2
          AND emoji = $3
        RETURNING id
        `,
        [messageId, user.id, emoji],
      );

      if (deletedResult.rowCount === 0) {
        return reply.status(404).send({
          error: {
            code: "REACTION_NOT_FOUND",
            message: "Reaction not found",
          },
        });
      }

      connectionManager.broadcastToChannel(
        message.channel_id,
        {
          type: "reaction.removed",
          data: {
            message_id: messageId,
            user_id: user.id,
            emoji,
          },
        },
      );

      return {
        data: {
          message_id: messageId,
          user_id: user.id,
          emoji,
        },
      };
    },
  );
};

export default reactionsRoute;