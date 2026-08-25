import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const paramsSchema = z.object({
  channelId: z.uuid(),
});

const bodySchema = z.object({
  isPrivate: z.boolean(),
});

const updateChannelPrivacyRoute: FastifyPluginAsync = async (app) => {
  app.patch(
    "/api/channels/:channelId/privacy",
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
            code: "INVALID_PRIVACY_SETTING",
            message: "isPrivate must be a boolean",
          },
        });
      }

      const { channelId } = parsedParams.data;
      const { isPrivate } = parsedBody.data;

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

      if (
        membership.role !== "OWNER" &&
        membership.role !== "ADMIN"
      ) {
        return reply.status(403).send({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message:
              "Only workspace owners and admins can change channel privacy",
          },
        });
      }

      const result = await app.db.query(
        `
        UPDATE channels
        SET
          is_private = $1,
          updated_at = NOW()
        WHERE id = $2
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
        [isPrivate, channelId],
      );

      return {
        data: result.rows[0],
      };
    },
  );
};

export default updateChannelPrivacyRoute;