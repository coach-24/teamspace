import Fastify from "fastify";
import websocketRoute from "./routes/websocket.js";
import databasePlugin from "./plugins/database.js";
import healthRoute from "./routes/health.js";
import workspaceRoute from "./routes/workspaces/index.js";
import workspaceDetailRoute from "./routes/workspaces/workspace.js";
import channelsRoute from "./routes/workspaces/channels.js";
import messagesRoute from "./routes/channels/messages.js";
import createMessageRoute from "./routes/channels/create-message.js";
import editMessageRoute from "./routes/channels/edit-message.js";
import deleteMessageRoute from "./routes/channels/delete-message.js";



import authPlugin from "./plugins/auth.js";
import membersRoute from "./routes/workspaces/members.js";
import channelRoute from "./routes/channels/channel.js";
import updateChannelRoute from "./routes/channels/update-channel.js";
import channelMembersRoute from "./routes/channels/members.js";
import updateChannelPrivacyRoute from "./routes/channels/update-channel-privacy.js";
import markMessageReadRoute from "./routes/channels/mark-message-read.js";
import notificationsRoute from "./routes/notifications.js";
import notificationsReadRoute from "./routes/notifications-read.js";
import notificationsUnreadCountRoute from "./routes/notifications-unread-count.js";


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
  app.register(membersRoute);
  app.register(channelRoute);
  app.register(updateChannelRoute);
  app.register(updateChannelPrivacyRoute);
  app.register(channelMembersRoute);
  app.register(messagesRoute);
  app.register(createMessageRoute);
  app.register(editMessageRoute);
  app.register(deleteMessageRoute);
  app.register(notificationsRoute);
  app.register(notificationsReadRoute);
  app.register(notificationsUnreadCountRoute);
  app.register(websocketRoute);
  app.register(markMessageReadRoute);

  return app;
};
