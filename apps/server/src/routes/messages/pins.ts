import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { connectionManager } from "../../realtime/connection-manager.js";

const messageParamsSchema = z.object({
  messageId: z.uuid(),
});

const channelParamsSchema = z.object({
  channelId: z.uuid(),
});

const pinsRoute: FastifyPluginAsync = async (app) => {
  // ============================================
  // PIN MESSAGE
  // ============================================

  app.post(
    "/api/messages/:messageId/pin",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = messageParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
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

      const { messageId } = parsed.data;

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
        const channelMemberResult =
          await app.db.query(
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
        const pinResult = await app.db.query(
          `
          INSERT INTO message_pins (
            message_id,
            pinned_by
          )
          VALUES ($1, $2)
          RETURNING
            id,
            message_id,
            pinned_by,
            created_at
          `,
          [messageId, user.id],
        );

        const pin = pinResult.rows[0];

        connectionManager.broadcastToChannel(
          message.channel_id,
          {
            type: "message.pinned",
            data: {
              ...pin,
              pinned_by_user: {
                id: user.id,
                display_name: user.display_name,
                email: user.email,
              },
            },
          },
        );

        return reply.status(201).send({
          data: pin,
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
              code: "MESSAGE_ALREADY_PINNED",
              message: "Message is already pinned",
            },
          });
        }

        throw error;
      }
    },
  );

  // ============================================
  // UNPIN MESSAGE
  // ============================================

  app.delete(
    "/api/messages/:messageId/pin",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = messageParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MESSAGE_ID",
            message: "Message ID must be a valid UUID",
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

      const { messageId } = parsed.data;

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
        const channelMemberResult =
          await app.db.query(
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
        DELETE FROM message_pins
        WHERE message_id = $1
        RETURNING id
        `,
        [messageId],
      );

      if (deletedResult.rowCount === 0) {
        return reply.status(404).send({
          error: {
            code: "MESSAGE_NOT_PINNED",
            message: "Message is not pinned",
          },
        });
      }

      connectionManager.broadcastToChannel(
        message.channel_id,
        {
          type: "message.unpinned",
          data: {
            message_id: messageId,
          },
        },
      );

      return {
        data: {
          message_id: messageId,
          unpinned: true,
        },
      };
    },
  );

  // ============================================
  // LIST CHANNEL PINS
  // ============================================

  app.get(
    "/api/channels/:channelId/pins",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = channelParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
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

      const { channelId } = parsed.data;

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

      const channelResult = await app.db.query(
        `
        SELECT
          id,
          workspace_id,
          is_private
        FROM channels
        WHERE id = $1
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
        [channel.workspace_id, user.id],
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

      if (channel.is_private) {
        const channelMemberResult =
          await app.db.query(
            `
            SELECT id
            FROM channel_members
            WHERE channel_id = $1
              AND user_id = $2
            `,
            [channelId, user.id],
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

      const result = await app.db.query(
        `
        SELECT
          p.id,
          p.message_id,
          p.pinned_by,
          u.display_name AS pinned_by_name,
          u.avatar_url AS pinned_by_avatar_url,
          p.created_at
        FROM message_pins p
        INNER JOIN messages m
          ON m.id = p.message_id
        INNER JOIN users u
          ON u.id = p.pinned_by
        WHERE m.channel_id = $1
        ORDER BY p.created_at DESC
        `,
        [channelId],
      );

      return {
        data: result.rows,
      };
    },
  );
};

export default pinsRoute;