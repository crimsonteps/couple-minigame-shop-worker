import type { AppContext } from "../app-context";
import { methodNotAllowed } from "../shared/response";
import { assertUserId } from "../shared/utils";
import { buildRoomRequest, getRoom } from "./room-proxy";

export async function handleDashboardRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const url = new URL(request.url);
  const userId = assertUserId(url.searchParams.get("user"));
  return getRoom(context).fetch(buildRoomRequest(`/internal/dashboard?user=${userId}`));
}
