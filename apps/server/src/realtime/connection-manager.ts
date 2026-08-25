import type { WebSocket } from "ws";

type Connection = {
  userId: string;
  socket: WebSocket;
  channels: Set<string>;
};

class ConnectionManager {
  private readonly connections = new Map<
    WebSocket,
    Connection
  >();

  add(
    socket: WebSocket,
    userId: string,
  ) {
    this.connections.set(socket, {
      userId,
      socket,
      channels: new Set(),
    });
  }

  getUserConnectionCount(userId: string) {
    let count = 0;

    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        count++;
      }
    }

    return count;
  }

  getUserId(socket: WebSocket) {
    return this.connections.get(socket)?.userId;
  }

  remove(socket: WebSocket) {
    this.connections.delete(socket);
  }

  joinChannel(
    socket: WebSocket,
    channelId: string,
  ) {
    const connection = this.connections.get(socket);

    if (!connection) {
      return;
    }

    connection.channels.add(channelId);
  }

  broadcastToUser(
    userId: string,
    message: unknown,
  ) {
    const payload = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (connection.userId !== userId) {
        continue;
      }

      if (connection.socket.readyState !== 1) {
        continue;
      }

      connection.socket.send(payload);
    }
  }

  broadcastToOthers(
    userId: string,
    message: unknown,
  ) {
    const payload = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        continue;
      }

      if (connection.socket.readyState !== 1) {
        continue;
      }

      connection.socket.send(payload);
    }
  }

  broadcastToChannel(
    channelId: string,
    message: unknown,
  ) {
    const payload = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (!connection.channels.has(channelId)) {
        continue;
      }

      if (connection.socket.readyState !== 1) {
        continue;
      }

      connection.socket.send(payload);
    }
  }
}

export const connectionManager =
  new ConnectionManager();