import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { AppContext } from "./app-context";
import {
  handleAdminRequest,
  handleAdminShopCreateRequest,
  handleAdminShopDeleteRequest,
  handleAdminShopUpdateRequest,
  handleAdminUserScoreUpdateRequest,
} from "./api/admin";
import { handleDashboardRequest } from "./api/dashboard";
import { handleHealthRequest } from "./api/health";
import { handleProfileRequest } from "./api/profile";
import { handleRecordsRequest } from "./api/records";
import { handleShopRedeemRequest, handleShopRequest } from "./api/shop";
import { CoupleRoom } from "./room/CoupleRoom";
import { openSqliteStorage } from "./room/storage/sqlite-storage";
import { NotFoundError, ValidationError } from "./shared/errors";
import { jsonError } from "./shared/response";
import { assertUserId, isAdminUserId, normalizeUserId } from "./shared/utils";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(rootDir, "public");

function resolveFromCurrentProject(input: string): string {
  if (isAbsolute(input)) {
    return input;
  }

  return resolve(process.cwd(), input);
}

function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return resolveFromCurrentProject(process.env.DATABASE_PATH);
  }

  const dataDir = process.env.DATA_DIR
    ? resolveFromCurrentProject(process.env.DATA_DIR)
    : resolve(rootDir, "data");

  return resolve(dataDir, "couple-home.sqlite");
}

export function createAppContext(): { close(): void; context: AppContext } {
  const { close, storage } = openSqliteStorage(getDatabasePath());

  return {
    close,
    context: {
      room: new CoupleRoom(storage),
    },
  };
}

export async function handleAppRequest(request: Request, context: AppContext): Promise<Response> {
  try {
    const url = new URL(request.url);

    if (url.pathname === "/api/dashboard") {
      return handleDashboardRequest(request, context);
    }

    if (url.pathname === "/api/shop") {
      return handleShopRequest(request, context);
    }

    if (url.pathname === "/api/shop/redeem") {
      return handleShopRedeemRequest(request, context);
    }

    if (url.pathname === "/api/records") {
      return handleRecordsRequest(request, context);
    }

    if (url.pathname === "/api/profile") {
      return handleProfileRequest(request, context);
    }

    if (url.pathname === "/api/health") {
      return handleHealthRequest(request, context);
    }

    if (url.pathname === "/api/admin") {
      return handleAdminRequest(request, context);
    }

    if (url.pathname === "/api/admin/users/score") {
      return handleAdminUserScoreUpdateRequest(request, context);
    }

    if (url.pathname === "/api/admin/shop/create") {
      return handleAdminShopCreateRequest(request, context);
    }

    if (url.pathname === "/api/admin/shop/update") {
      return handleAdminShopUpdateRequest(request, context);
    }

    if (url.pathname === "/api/admin/shop/delete") {
      return handleAdminShopDeleteRequest(request, context);
    }

    if (url.pathname === "/ws") {
      throw new ValidationError("WEBSOCKET_UPGRADE_REQUIRED", "这个接口只接受 WebSocket 升级请求。");
    }

    if (url.pathname === "/admin.html") {
      const requestedUser = normalizeUserId(url.searchParams.get("user"));

      if (!requestedUser || !isAdminUserId(requestedUser)) {
        const redirectUrl = new URL(request.url);
        redirectUrl.pathname = requestedUser ? "/index.html" : "/choose.html";
        redirectUrl.search = requestedUser ? `?user=${requestedUser}` : "";
        return Response.redirect(redirectUrl, 302);
      }
    }

    return serveStaticAsset(url.pathname);
  } catch (error) {
    return jsonError(error);
  }
}

async function serveStaticAsset(pathname: string): Promise<Response> {
  const normalizedPath = pathname === "/" ? "/choose.html" : pathname;
  const assetPath = resolve(publicDir, `.${normalizedPath}`);
  const relativePath = relative(publicDir, assetPath);

  if (relativePath.startsWith("..")) {
    throw new NotFoundError("ASSET_NOT_FOUND", "页面不存在。");
  }

  try {
    const body = await readFile(assetPath);

    return new Response(body, {
      headers: {
        "cache-control": "no-store",
        "content-type": getContentType(assetPath),
      },
      status: 200,
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      throw new NotFoundError("ASSET_NOT_FOUND", "页面不存在。");
    }

    throw error;
  }
}

function getContentType(assetPath: string): string {
  switch (extname(assetPath)) {
    case ".css":
      return "text/css; charset=UTF-8";
    case ".html":
      return "text/html; charset=UTF-8";
    case ".js":
      return "application/javascript; charset=UTF-8";
    case ".json":
      return "application/json; charset=UTF-8";
    case ".map":
      return "application/json; charset=UTF-8";
    case ".svg":
      return "image/svg+xml; charset=UTF-8";
    default:
      return "application/octet-stream";
  }
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const origin = `http://${request.headers.host ?? "127.0.0.1"}`;
  const url = new URL(request.url ?? "/", origin);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const method = request.method ?? "GET";

  if (method === "GET" || method === "HEAD") {
    return new Request(url, { headers, method });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  return new Request(url, { body, headers, method });
}

async function sendNodeResponse(nodeResponse: ServerResponse, response: Response): Promise<void> {
  nodeResponse.statusCode = response.status;
  nodeResponse.statusMessage = response.statusText;

  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  const body = await response.arrayBuffer();
  nodeResponse.end(Buffer.from(body));
}

function normalizeWebSocketMessage(message: RawData): string | ArrayBuffer | ArrayBufferView {
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return Buffer.concat(message);
  }

  return message;
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  socket.write(
    [
      `HTTP/1.1 ${status} ${status === 404 ? "Not Found" : "Bad Request"}`,
      "Connection: close",
      "Content-Type: text/plain; charset=UTF-8",
      `Content-Length: ${Buffer.byteLength(message)}`,
      "",
      message,
    ].join("\r\n"),
  );
  socket.destroy();
}

export function startServer(): void {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? "8787");
  const runtime = createAppContext();
  const server = createServer(async (request, response) => {
    try {
      const webRequest = await toWebRequest(request);
      const webResponse = await handleAppRequest(webRequest, runtime.context);
      await sendNodeResponse(response, webResponse);
    } catch (error) {
      const webResponse = jsonError(error);
      await sendNodeResponse(response, webResponse);
    }
  });
  const websocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

    if (url.pathname !== "/ws") {
      rejectUpgrade(socket, 404, "WebSocket route not found.");
      return;
    }

    let userId;

    try {
      userId = assertUserId(url.searchParams.get("user"));
    } catch {
      rejectUpgrade(socket, 400, "Invalid user.");
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
      runtime.context.room.connect(userId, websocket);

      websocket.on("message", (message: RawData) => {
        runtime.context.room.handleSocketMessage(websocket, normalizeWebSocketMessage(message));
      });

      websocket.on("close", () => {
        runtime.context.room.handleSocketClose(websocket);
      });

      websocket.on("error", (error: Error) => {
        runtime.context.room.handleSocketError(websocket, error);
      });
    });
  });

  const shutdown = () => {
    websocketServer.close();
    server.close(() => {
      runtime.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, host, () => {
    console.log(`Oh Kanh Mini Game server listening on http://${host}:${port}`);
    console.log(`Database path: ${getDatabasePath()}`);
  });
}

if (isMainModule()) {
  startServer();
}
