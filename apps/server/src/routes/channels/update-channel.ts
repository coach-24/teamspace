import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const paramsSchema = z.object({
  channelId: z.uuid(),
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

const updateChannelRoute: FastifyPluginAsync = async (app) => {
  app.patch(
    "/api/channels/:channelId",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate parameters
      // ============================================

      const parsedParams = paramsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

      // ============================================
      // Validate body
      // ============================================

      const parsedBody = bodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_UPDATE",
            message: "Invalid channel update data",
          },
        });
      }

      const { channelId } = parsedParams.data;
      const { name, description } = parsedBody.data;

      if (name === undefined && description === undefined) {
        return reply.status(400).send({
          error: {
            code: "NO_CHANGES",
            message: "At least one channel field must be provided",
          },
        });
      }

      // ============================================
      // Find channel
      // ============================================

      const channelResult = await app.db.query(
        `
        SELECT
          id,
          workspace_id,
          name,
          description
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
      // Workspace membership
      // ============================================

      const membership = await getWorkspaceMembership(
        app,
        request,
        channel.workspace_id,
      );

      if (!membership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      // ============================================
      // Channel role
      // ============================================

      const channelRoleResult = await app.db.query(
        `
        SELECT cm.role
        FROM channel_members cm
        INNER JOIN users u
          ON u.id = cm.user_id
        WHERE cm.channel_id = $1
          AND u.auth_user_id = $2
        `,
        [channelId, request.user!.id],
      );

      const channelRole = channelRoleResult.rows[0]?.role;

      const canUpdate =
        membership.role === "OWNER" ||
        membership.role === "ADMIN" ||
        channelRole === "CHANNEL_MANAGER";

      if (!canUpdate) {
        return reply.status(403).send({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message:
              "Only workspace owners, admins, and channel managers can update channel details",
          },
        });
      }

      // ============================================
      // Update channel
      // ============================================

      const updatedResult = await app.db.query(
        `
        UPDATE channels
        SET
          name = COALESCE($1, name),
          description = CASE
            WHEN $2::boolean THEN $3
            ELSE description
          END,
          updated_at = NOW()
        WHERE id = $4
        RETURNING
          id,
          workspace_id,
          name,
          slug,
          description,
          is_private,
          created_by,
          created_at,
          updated_at
        `,
        [
          name ?? null,
          description !== undefined,
          description ?? null,
          channelId,
        ],
      );

      return {
        data: updatedResult.rows[0],
      };
    },
  );
};

export default updateChannelRoute;