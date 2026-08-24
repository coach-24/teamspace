import type { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "teamspace-server",
    };
  });

  app.get("/health/db", async () => {
    const result = await app.db.query("SELECT 1 AS connected");

    return {
      status: "ok",
      database: result.rows[0]?.connected === 1,
    };
  });
};

export default healthRoute;
