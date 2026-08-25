import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getWorkspaceMembership } from "../../utils/workspace-auth.js";

const workspaceParamsSchema = z.object({
  workspaceId: z.uuid(),
});

const channelsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/workspaces/:workspaceId/channels",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = workspaceParamsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "INVALID_WORKSPACE_ID",
            message: "Workspace ID must be a valid UUID",
          },
        });
      }

      const { workspaceId } = parsed.data;

      const membership = await getWorkspaceMembership(
        app,
        request,
        workspaceId,
      );

      if (!membership) {
        return reply.status(403).send({
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "You are not a member of this workspace",
          },
        });
      }

      const result = await app.db.query(
        `
        SELECT
          c.id,
          c.name,
          c.slug,
          c.description,
          c.is_private,
          c.created_by,
          c.created_at,
          c.updated_at
        FROM channels c
        WHERE c.workspace_id = $1
        ORDER BY c.created_at ASC
        `,
        [workspaceId],
      );

      return {
        data: result.rows,
      };
    },
  );
};

export default channelsRoute;