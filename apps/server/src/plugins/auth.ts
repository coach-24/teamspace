import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const authPlugin: FastifyPluginAsync = async (app) => {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
  );

  app.decorate("supabase", supabase);

  app.decorateRequest("user", null);

  app.addHook("preHandler", async (request, reply) => {
  if (!request.routeOptions.config.requiresAuth) {
    return;
  }

  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Bearer token is required",
      },
    });
  }

  const token = authorization.slice("Bearer ".length);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return reply.status(401).send({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired access token",
      },
    });
  }

  request.user = data.user;
});
};

export default fp(authPlugin, {
  name: "auth",
});