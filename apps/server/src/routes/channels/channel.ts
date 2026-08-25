import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const channelParamsSchema = z.object({
  channelId: z.uuid(),
});

const channelRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/channels/:channelId",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      // ============================================
      // Validate channel ID
      // ============================================

      const parsed = channelParamsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHANNEL_ID",
            message: "Channel ID must be a valid UUID",
          },
        });
      }

      const { channelId } = parsed.data;

      // ============================================
      // Find channel
      // ============================================

      const result = await app.db.query(
        `
        SELECT
          c.id,
          c.workspace_id,
          c.name,
          c.slug,
          c.description,
          c.is_private,
          c.created_by,
          c.created_at,
          c.updated_at
        FROM channels c
        WHERE c.id = $1
        `,
        [channelId],
      );

      const channel = result.rows[0];

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: "CHANNEL_NOT_FOUND",
            message: "Channel not found",
          },
        });
      }

      // ============================================
      // Verify workspace membership
      // ============================================

      const membership = await getWorkspaceMembership(
  app,
  request,
  channel.workspace_id,
);

if (!membership) {
  return reply.status(403).send({
    error: {
      code: "CHANNEL_ACCESS_DENIED",
      message: "You are not a member of this workspace",
    },
  });
}

// ============================================
// Private channel authorization
// ============================================

if (channel.is_private) {
  const channelMemberResult = await app.db.query(
    `
    SELECT 1
    FROM channel_members cm
    JOIN users u
      ON u.id = cm.user_id
    WHERE cm.channel_id = $1
      AND u.auth_user_id = $2
    LIMIT 1
    `,
    [channel.id, request.user!.id],
  );

  if (channelMemberResult.rowCount === 0) {
    return reply.status(403).send({
      error: {
        code: "CHANNEL_ACCESS_DENIED",
        message: "You do not have access to this private channel",
      },
    });
  }
}

      // ============================================
      // Return channel
      // ============================================

      return {
        data: channel,
      };
    },
  );
};

export default channelRoute;