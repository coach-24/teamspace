import type { FastifyPluginAsync } from "fastify";

const workspaceRoute: FastifyPluginAsync = async (app) => {
  app.get("/api/workspaces", { config: { requiresAuth: true } }, async () => {
    const result = await app.db.query(`
      SELECT
        w.id,
        w.name,
        w.slug,
        w.owner_id,
        w.created_at,
        w.updated_at
      FROM workspaces w
      ORDER BY w.created_at DESC
    `);

    return {
      data: result.rows,
    };
  });
};

export default workspaceRoute;