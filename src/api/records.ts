import type { AppContext } from "../app-context";
import { methodNotAllowed } from "../shared/response";
import { buildRoomRequest, getRoom } from "./room-proxy";

export async function handleRecordsRequest(request: Request, context: AppContext): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  return getRoom(context).fetch(buildRoomRequest("/internal/records"));
}
