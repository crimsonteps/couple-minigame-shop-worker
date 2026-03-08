import type { AppContext } from "../app-context";
import type { CoupleRoom } from "../room/CoupleRoom";
import { getInternalRoomUrl } from "../shared/utils";

export function getRoom(context: AppContext): CoupleRoom {
  return context.room;
}

export function buildRoomRequest(pathname: string, init?: RequestInit): Request {
  const requestInit = init?.body === undefined ? init : ({ ...init, duplex: "half" } as RequestInit & { duplex: "half" });
  return new Request(getInternalRoomUrl(pathname), requestInit);
}
