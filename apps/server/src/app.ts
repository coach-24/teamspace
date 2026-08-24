import Fastify from "fastify";
import databasePlugin from "./plugins/database.js";
import healthRoute from "./routes/health.js";
import workspaceRoute from "./routes/workspaces/index.js";
import workspaceDetailRoute from "./routes/workspaces/workspace.js";
import channelsRoute from "./routes/workspaces/channels.js";
import messagesRoute from "./routes/channels/messages.js";
import createMessageRoute from "./routes/channels/create-message.js";
import authPlugin from "./plugins/auth.js";

export const buildApp = () => {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const isObject =
      typeof error === "object" && error !== null;

    const statusCode =
      isObject &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    const code =
      isObject &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "INTERNAL_SERVER_ERROR";

    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong";

    return reply.status(statusCode).send({
      error: {
        code,
        message,
      },
    });
  });

  app.register(databasePlugin);
  app.register(authPlugin);

  app.register(healthRoute);
  app.register(workspaceRoute);
  app.register(workspaceDetailRoute);
  app.register(channelsRoute);
  app.register(messagesRoute);
  app.register(createMessageRoute);

  return app;
};
