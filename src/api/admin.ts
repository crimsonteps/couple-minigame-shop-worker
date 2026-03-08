import type { AppContext } from "../app-context";
import { methodNotAllowed } from "../shared/response";
import { buildRoomRequest, getRoom } from "./room-proxy";

export async function handleAdminRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const url = new URL(request.url);
  return getRoom(context).fetch(buildRoomRequest(`/internal/admin${url.search}`));
}

export async function handleAdminUserScoreUpdateRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return getRoom(context).fetch(
    buildRoomRequest("/internal/admin/users/score", {
      body: request.body,
      headers: request.headers,
      method: "POST",
    }),
  );
}

export async function handleAdminShopCreateRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return getRoom(context).fetch(
    buildRoomRequest("/internal/admin/shop/create", {
      body: request.body,
      headers: request.headers,
      method: "POST",
    }),
  );
}

export async function handleAdminShopUpdateRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return getRoom(context).fetch(
    buildRoomRequest("/internal/admin/shop/update", {
      body: request.body,
      headers: request.headers,
      method: "POST",
    }),
  );
}

export async function handleAdminShopDeleteRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return getRoom(context).fetch(
    buildRoomRequest("/internal/admin/shop/delete", {
      body: request.body,
      headers: request.headers,
      method: "POST",
    }),
  );
}
