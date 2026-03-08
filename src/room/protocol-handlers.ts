import { AppError, ValidationError } from "../shared/errors";
import type { ClientMessage, NoticeLevel, ServerMessage } from "../shared/protocol";
import { assertGameType, assertInteger, assertRpsChoice } from "../shared/utils";
import type { UserId } from "../shared/types";

export interface ProtocolRoomActions {
  startGame(userId: UserId, gameType: ReturnType<typeof assertGameType>): void;
  submitGuessNumber(userId: UserId, value: number): void;
  submitRpsChoice(userId: UserId, choice: ReturnType<typeof assertRpsChoice>): void;
  submitTelepathyChoice(userId: UserId, optionId: string): void;
  sync(userId: UserId): void;
}

export function parseClientMessage(rawMessage: string | ArrayBuffer | ArrayBufferView): ClientMessage {
  let textMessage: string;

  if (typeof rawMessage === "string") {
    textMessage = rawMessage;
  } else if (ArrayBuffer.isView(rawMessage)) {
    textMessage = new TextDecoder().decode(rawMessage);
  } else if (rawMessage instanceof ArrayBuffer) {
    textMessage = new TextDecoder().decode(new Uint8Array(rawMessage));
  } else {
    throw new ValidationError("BINARY_MESSAGE_NOT_SUPPORTED", "只支持文本协议消息。");
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(textMessage) as Record<string, unknown>;
  } catch {
    throw new ValidationError("INVALID_PROTOCOL_JSON", "WebSocket 消息必须是 JSON。");
  }

  if (payload.type === "dashboard:sync") {
    return { type: "dashboard:sync" };
  }

  if (payload.type === "game:start") {
    return {
      gameType: assertGameType(payload.gameType),
      type: "game:start",
    };
  }

  if (payload.type === "rps:choice") {
    return {
      choice: assertRpsChoice(payload.choice),
      type: "rps:choice",
    };
  }

  if (payload.type === "telepathy:choice") {
    const optionId = String(payload.optionId ?? "").trim();

    if (!optionId) {
      throw new ValidationError("INVALID_OPTION", "默契问答必须提交一个选项。");
    }

    return {
      optionId,
      type: "telepathy:choice",
    };
  }

  if (payload.type === "guess-number:submit") {
    return {
      type: "guess-number:submit",
      value: assertInteger(payload.value, "INVALID_GUESS", "猜数字必须提交整数。"),
    };
  }

  throw new ValidationError("UNKNOWN_MESSAGE_TYPE", "未知的协议消息类型。");
}

export function handleProtocolMessage(
  actions: ProtocolRoomActions,
  userId: UserId,
  rawMessage: string | ArrayBuffer | ArrayBufferView,
): void {
  const message = parseClientMessage(rawMessage);

  switch (message.type) {
    case "dashboard:sync":
      actions.sync(userId);
      return;
    case "game:start":
      actions.startGame(userId, message.gameType);
      return;
    case "rps:choice":
      actions.submitRpsChoice(userId, message.choice);
      return;
    case "telepathy:choice":
      actions.submitTelepathyChoice(userId, message.optionId);
      return;
    case "guess-number:submit":
      actions.submitGuessNumber(userId, message.value);
      return;
  }
}

export function createNoticeMessage(text: string, level: NoticeLevel = "info"): ServerMessage {
  return {
    payload: {
      level,
      text,
    },
    type: "notice",
  };
}

export function createErrorMessage(error: unknown): ServerMessage {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("INTERNAL_ERROR", "服务器开小差了，请稍后再试。", 500);

  return {
    payload: {
      code: appError.code,
      message: appError.message,
    },
    type: "error",
  };
}
