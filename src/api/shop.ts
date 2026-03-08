import type { AppContext } from "../app-context";
import { methodNotAllowed } from "../shared/response";
import { buildRoomRequest, getRoom } from "./room-proxy";

export async function handleShopRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  return getRoom(context).fetch(buildRoomRequest("/internal/shop"));
}

export async function handleShopRedeemRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return getRoom(context).fetch(
    buildRoomRequest("/internal/shop/redeem", {
      body: request.body,
      headers: request.headers,
      method: "POST",
    }),
  );
}
