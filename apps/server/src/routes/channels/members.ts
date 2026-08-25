import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const channelParamsSchema = z.object({
  channelId: z.uuid(),
});

const addMemberBodySchema = z.object({
  userId: z.uuid(),
});

const channelMembersRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/channels/:channelId/members",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate channel ID
      // ============================================

      const params = channelParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

      const { channelId } = params.data;

      // ============================================
      // Validate request body
      // ============================================

      const body = addMemberBodySchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: body.error.message,
          },
        });
      }

      const { userId } = body.data;

      // ============================================
      // Find channel
      // ============================================

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

      // ============================================
      // Verify requester workspace membership
      // ============================================

      const requesterMembership =
        await getWorkspaceMembership(
          app,
          request,
          channel.workspace_id,
        );

      if (!requesterMembership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      // ============================================
      // Only OWNER / ADMIN can manage channel members
      // ============================================

      if (
        requesterMembership.role !== "OWNER" &&
        requesterMembership.role !== "ADMIN"
      ) {
        return reply.status(403).send({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message:
              "Only workspace owners and admins can manage channel members",
          },
        });
      }

      // ============================================
      // Target user must exist
      // ============================================

      const targetUserResult = await app.db.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
        `,
        [userId],
      );

      const targetUser = targetUserResult.rows[0];

      if (!targetUser) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // ============================================
      // Target user must belong to workspace
      // ============================================

      const targetMembershipResult =
        await app.db.query(
          `
          SELECT id
          FROM memberships
          WHERE workspace_id = $1
            AND user_id = $2
          `,
          [channel.workspace_id, targetUser.id],
        );

      if (targetMembershipResult.rowCount === 0) {
        return reply.status(400).send({
          error: {
            code: "USER_NOT_IN_WORKSPACE",
            message:
              "User must be a member of the workspace before joining the channel",
          },
        });
      }

      // ============================================
      // Add channel member
      // ============================================

      try {
        const result = await app.db.query(
          `
          INSERT INTO channel_members (
            channel_id,
            user_id
          )
          VALUES ($1, $2)
          RETURNING
            id,
            channel_id,
            user_id,
            joined_at
          `,
          [channelId, targetUser.id],
        );

        return reply.status(201).send({
          data: result.rows[0],
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
              code: "ALREADY_CHANNEL_MEMBER",
              message:
                "User is already a member of this channel",
            },
          });
        }

        throw error;
      }
    },
  );
    app.delete(
    "/api/channels/:channelId/members/:userId",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate params
      // ============================================

      const paramsSchema = z.object({
        channelId: z.uuid(),
        userId: z.uuid(),
      });

      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_PARAMETERS",
            message: "Channel ID and user ID must be valid UUIDs",
          },
        });
      }

      const { channelId, userId } = parsed.data;

      // ============================================
      // Find channel
      // ============================================

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

      // ============================================
      // Verify requester workspace membership
      // ============================================

      const requesterMembership =
        await getWorkspaceMembership(
          app,
          request,
          channel.workspace_id,
        );

      if (!requesterMembership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      // ============================================
      // Only OWNER / ADMIN can remove members
      // ============================================

      if (
        requesterMembership.role !== "OWNER" &&
        requesterMembership.role !== "ADMIN"
      ) {
        return reply.status(403).send({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message:
              "Only workspace owners and admins can manage channel members",
          },
        });
      }

      // ============================================
      // Prevent removing the channel creator
      // ============================================

      const creatorResult = await app.db.query(
        `
        SELECT created_by
        FROM channels
        WHERE id = $1
        `,
        [channelId],
      );

      const creatorId = creatorResult.rows[0]?.created_by;

      if (creatorId === userId) {
        return reply.status(400).send({
          error: {
            code: "CHANNEL_CREATOR_CANNOT_BE_REMOVED",
            message:
              "The channel creator cannot be removed from the channel",
          },
        });
      }

      // ============================================
      // Remove channel member
      // ============================================

      const result = await app.db.query(
        `
        DELETE FROM channel_members
        WHERE channel_id = $1
          AND user_id = $2
        RETURNING
          id,
          channel_id,
          user_id,
          joined_at
        `,
        [channelId, userId],
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: {
            code: "CHANNEL_MEMBER_NOT_FOUND",
            message: "User is not a member of this channel",
          },
        });
      }

      return {
        data: {
          removed: true,
          membership: result.rows[0],
        },
      };
    },
  );
};

export default channelMembersRoute;