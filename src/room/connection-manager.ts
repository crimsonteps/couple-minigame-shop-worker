import { WebSocket } from "ws";
import { createEmptyOnlineStatus, nowIso } from "../shared/utils";
import type { OnlineStatus, UserId } from "../shared/types";

interface SocketAttachment {
  connectedAt: string;
  userId: UserId;
}

export class ConnectionManager {
  private readonly sockets = new Map<WebSocket, SocketAttachment>();

  accept(userId: UserId, socket: WebSocket): void {
    for (const existingSocket of this.findSocketsByUser(userId)) {
      try {
        existingSocket.close(4001, "Superseded by a newer session.");
      } catch (error) {
        console.warn("Failed to close existing socket", error);
      } finally {
        this.remove(existingSocket);
      }
    }

    this.sockets.set(socket, {
      connectedAt: nowIso(),
      userId,
    });
  }

  remove(socket: WebSocket): void {
    this.sockets.delete(socket);
  }

  getUserId(socket: WebSocket): UserId | null {
    return this.sockets.get(socket)?.userId ?? null;
  }

  getOnlineStatus(): OnlineStatus {
    const status = createEmptyOnlineStatus();

    for (const attachment of this.sockets.values()) {
      status[attachment.userId] = true;
    }

    return status;
  }

  broadcast(message: unknown): void {
    const payload = JSON.stringify(message);

    for (const socket of this.sockets.keys()) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.remove(socket);
        continue;
      }

      try {
        socket.send(payload);
      } catch (error) {
        console.warn("Failed to broadcast message", error);
        this.remove(socket);
      }
    }
  }

  sendToUser(userId: UserId, message: unknown): void {
    const payload = JSON.stringify(message);

    for (const socket of this.findSocketsByUser(userId)) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.remove(socket);
        continue;
      }

      try {
        socket.send(payload);
      } catch (error) {
        console.warn("Failed to send direct message", error);
        this.remove(socket);
      }
    }
  }

  private findSocketsByUser(userId: UserId): WebSocket[] {
    const sockets: WebSocket[] = [];

    for (const [socket, attachment] of this.sockets.entries()) {
      if (attachment.userId === userId) {
        sockets.push(socket);
      }
    }

    return sockets;
  }
}
