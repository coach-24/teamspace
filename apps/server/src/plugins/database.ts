import fp from "fastify-plugin";
import { Pool } from "pg";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

const databasePlugin: FastifyPluginAsync = async (app) => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  await pool.query("SELECT 1");

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
};

export default fp(databasePlugin, {
  name: "database",
});