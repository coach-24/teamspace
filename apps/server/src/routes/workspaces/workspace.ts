import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const workspaceParamsSchema = z.object({
  workspaceId: z.uuid(),
});

const workspaceRoute: FastifyPluginAsync = async (app) => {
  app.get("/api/workspaces/:workspaceId", { config: { requiresAuth: true } }, async (request, reply) => {
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

    const result = await app.db.query(
      `
      SELECT
        w.id,
        w.name,
        w.slug,
        w.owner_id,
        w.created_at,
        w.updated_at
      FROM workspaces w
      WHERE w.id = $1
      `,
      [workspaceId],
    );

    const workspace = result.rows[0];

    if (!workspace) {
      return reply.status(404).send({
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        },
      });
    }

    return {
      data: workspace,
    };
  });
};

export default workspaceRoute;