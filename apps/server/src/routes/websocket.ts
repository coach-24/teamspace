import type { FastifyPluginAsync } from "fastify";
import websocket from "@fastify/websocket";
import { z } from "zod";
import { connectionManager } from "../realtime/connection-manager.js";

const joinChannelSchema = z.object({
  type: z.literal("channel.join"),
  channelId: z.uuid(),
});

const typingSchema = z.object({
  type: z.enum([
    "typing.start",
    "typing.stop",
  ]),
  channelId: z.uuid(),
});

const websocketRoute: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  app.get(
    "/ws",
    { websocket: true },
    async (socket, request) => {
      // ============================================
      // Read access token
      // ============================================

      const query = request.query as {
        token?: string;
      };

      const token = query.token;

      if (!token) {
        socket.close(
          1008,
          "Authentication required",
        );

        return;
      }

      // ============================================
      // Authenticate Supabase user
      // ============================================

      const { data, error } =
        await app.supabase.auth.getUser(token);

      if (error || !data.user) {
        socket.close(
          1008,
          "Invalid or expired access token",
        );

        return;
      }

      // ============================================
      // Resolve TeamSpace user
      // ============================================

      const userResult = await app.db.query(
        `
        SELECT
          id,
          display_name,
          email
        FROM users
        WHERE auth_user_id = $1
        `,
        [data.user.id],
      );

      const user = userResult.rows[0];

      if (!user) {
        socket.close(
          1008,
          "User not linked",
        );

        return;
      }

      // ============================================
      // Register authenticated connection
      // ============================================

      const existingConnections =
        connectionManager.getUserConnectionCount(
          user.id,
        );

      connectionManager.add(
        socket,
        user.id,
      );

      // ============================================
      // Notify user that they are online
      // ============================================

      if (existingConnections === 0) {
                await app.db.query(
        `
        UPDATE users
        SET last_seen_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        `,
        [user.id],
        );
        connectionManager.broadcastToOthers(
          user.id,
          {
            type: "presence.online",
            user: {
              id: user.id,
              display_name: user.display_name,
              email: user.email,
            },
          },
        );
      }

      // ============================================
      // Confirm authentication
      // ============================================

      socket.send(
        JSON.stringify({
          type: "connection.authenticated",
          user: {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
          },
        }),
      );

      // ============================================
      // Handle WebSocket messages
      // ============================================

      socket.on(
        "message",
        async (rawMessage) => {
          try {
            const parsedJson = JSON.parse(
  rawMessage.toString(),
);

if (
  parsedJson?.type === "typing.start" ||
  parsedJson?.type === "typing.stop"
) {
  const typingParsed =
    typingSchema.safeParse(
      parsedJson,
    );

  if (!typingParsed.success) {
    socket.send(
      JSON.stringify({
        type: "error",
        code: "INVALID_MESSAGE",
        message:
          "Invalid typing message",
      }),
    );

    return;
  }

  const {
    type,
    channelId,
  } = typingParsed.data;

  // ========================================
  // Verify this socket joined the channel
  // ========================================

  const channelAccessResult =
    await app.db.query(
      `
      SELECT
        c.id,
        c.workspace_id,
        c.is_private
      FROM channels c
      WHERE c.id = $1
      `,
      [channelId],
    );

  const typingChannel =
    channelAccessResult.rows[0];

  if (!typingChannel) {
    socket.send(
      JSON.stringify({
        type: "error",
        code: "CHANNEL_NOT_FOUND",
        message: "Channel not found",
      }),
    );

    return;
  }

  // ========================================
  // Verify workspace membership
  // ========================================

  const typingMembershipResult =
    await app.db.query(
      `
      SELECT id
      FROM memberships
      WHERE workspace_id = $1
        AND user_id = $2
      `,
      [
        typingChannel.workspace_id,
        user.id,
      ],
    );

  if (
    typingMembershipResult.rowCount ===
    0
  ) {
    socket.send(
      JSON.stringify({
        type: "error",
        code: "NOT_WORKSPACE_MEMBER",
        message:
          "User is not a member of this workspace",
      }),
    );

    return;
  }

  // ========================================
  // Verify private channel access
  // ========================================

  if (typingChannel.is_private) {
    const typingChannelMemberResult =
      await app.db.query(
        `
        SELECT id
        FROM channel_members
        WHERE channel_id = $1
          AND user_id = $2
        `,
        [
          channelId,
          user.id,
        ],
      );

    if (
      typingChannelMemberResult.rowCount ===
      0
    ) {
      socket.send(
        JSON.stringify({
          type: "error",
          code: "CHANNEL_ACCESS_DENIED",
          message:
            "You do not have access to this private channel",
        }),
      );

      return;
    }
  }

  // ========================================
  // Broadcast typing event
  // ========================================

  connectionManager.broadcastToChannel(
    channelId,
    {
      type,
      channelId,
      user: {
        id: user.id,
        display_name: user.display_name,
        email: user.email,
      },
    },
  );

  return;
}

const parsed =
  joinChannelSchema.safeParse(
    parsedJson,
  );

if (!parsed.success) {
  socket.send(
    JSON.stringify({
      type: "error",
      code: "INVALID_MESSAGE",
      message:
        "Invalid WebSocket message",
    }),
  );

  return;
}

const { channelId } = parsed.data;

            // ========================================
            // Find channel
            // ========================================

            const channelResult =
              await app.db.query(
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

            const channel =
              channelResult.rows[0];

            if (!channel) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  code: "CHANNEL_NOT_FOUND",
                  message: "Channel not found",
                }),
              );

              return;
            }

            // ========================================
            // Check workspace membership
            // ========================================

            const membershipResult =
              await app.db.query(
                `
                SELECT id
                FROM memberships
                WHERE workspace_id = $1
                  AND user_id = $2
                `,
                [
                  channel.workspace_id,
                  user.id,
                ],
              );

            if (
              membershipResult.rowCount === 0
            ) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  code: "NOT_WORKSPACE_MEMBER",
                  message:
                    "User is not a member of this workspace",
                }),
              );

              return;
            }

            // ========================================
            // Check private channel membership
            // ========================================

            if (channel.is_private) {
              const channelMemberResult =
                await app.db.query(
                  `
                  SELECT id
                  FROM channel_members
                  WHERE channel_id = $1
                    AND user_id = $2
                  `,
                  [
                    channelId,
                    user.id,
                  ],
                );

              if (
                channelMemberResult.rowCount ===
                0
              ) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    code: "CHANNEL_ACCESS_DENIED",
                    message:
                      "You do not have access to this private channel",
                  }),
                );

                return;
              }
            }

            // ========================================
            // Register channel subscription
            // ========================================

            connectionManager.joinChannel(
              socket,
              channelId,
            );

            socket.send(
              JSON.stringify({
                type: "channel.joined",
                channelId,
              }),
            );
          } catch {
            socket.send(
              JSON.stringify({
                type: "error",
                code: "INVALID_MESSAGE",
                message:
                  "WebSocket message must contain valid JSON",
              }),
            );
          }
        },
      );

      // ============================================
      // Handle disconnect
      // ============================================

      socket.on("close", async () => {
        const connectionCount =
          connectionManager.getUserConnectionCount(
            user.id,
          );

        connectionManager.remove(socket);

        // User's last connection closed
        if (connectionCount === 1) {
  const lastSeenAt = new Date();

  await app.db.query(
    `
    UPDATE users
    SET last_seen_at = $1,
        updated_at = NOW()
    WHERE id = $2
    `,
    [lastSeenAt, user.id],
  );

  connectionManager.broadcastToOthers(
    user.id,
    {
      type: "presence.offline",
      user: {
        id: user.id,
        display_name: user.display_name,
        email: user.email,
        last_seen_at: lastSeenAt,
      },
    },
  );
}

        console.log(
          `🔌 WebSocket disconnected: ${user.email}`,
        );
      });

      // ============================================
      // Handle socket errors
      // ============================================

      socket.on(
        "error",
        (error: Error) => {
          console.error(
            "❌ WebSocket error:",
            error,
          );
        },
      );
    },
  );
};

export default websocketRoute;