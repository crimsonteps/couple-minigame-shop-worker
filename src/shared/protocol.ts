import type { DashboardSnapshot, GameType, RpsChoice } from "./types";

export const CLIENT_MESSAGE_TYPES = [
  "dashboard:sync",
  "game:start",
  "rps:choice",
  "telepathy:choice",
  "guess-number:submit",
] as const;
export const SERVER_MESSAGE_TYPES = ["snapshot", "notice", "error"] as const;

export type ClientMessage =
  | { type: "dashboard:sync" }
  | { type: "game:start"; gameType: GameType }
  | { type: "rps:choice"; choice: RpsChoice }
  | { type: "telepathy:choice"; optionId: string }
  | { type: "guess-number:submit"; value: number };

export type NoticeLevel = "info" | "success" | "warning";

export type ServerMessage =
  | {
      type: "snapshot";
      payload: DashboardSnapshot;
    }
  | {
      type: "notice";
      payload: {
        level: NoticeLevel;
        text: string;
      };
    }
  | {
      type: "error";
      payload: {
        code: string;
        message: string;
      };
    };
