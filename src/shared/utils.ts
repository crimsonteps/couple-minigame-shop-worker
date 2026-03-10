import {
  ADMIN_USER_ID,
  FIXED_ROOM_ID,
  FIXED_USER_IDS,
  GAME_CATALOG,
  INITIAL_ROUND_STATE,
  LEGACY_USER_ID_MAP,
  RPS_OPTIONS,
  USER_DIRECTORY,
} from "./constants";
import { ValidationError } from "./errors";
import type {
  GameCatalogItem,
  GameType,
  OnlineStatus,
  PersistedRoundState,
  RoundSnapshot,
  RpsChoice,
  ScoreBoard,
  TelepathyOption,
  UserId,
  UserRole,
} from "./types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyScoreBoard(): ScoreBoard {
  return Object.fromEntries(FIXED_USER_IDS.map((userId) => [userId, 0])) as ScoreBoard;
}

export function createEmptyOnlineStatus(): OnlineStatus {
  return Object.fromEntries(FIXED_USER_IDS.map((userId) => [userId, false])) as OnlineStatus;
}

export function isUserId(value: unknown): value is UserId {
  return FIXED_USER_IDS.includes(String(value) as UserId);
}

export function normalizeUserId(value: unknown): UserId | null {
  if (isUserId(value)) {
    return value;
  }

  if (value === "u1" || value === "u2") {
    return LEGACY_USER_ID_MAP[value];
  }

  return null;
}

export function assertUserId(value: unknown): UserId {
  const normalized = normalizeUserId(value);

  if (!normalized) {
    throw new ValidationError("INVALID_USER", "用户只能是固定的 yzy 或 wh。");
  }

  return normalized;
}

export function isAdminUserId(userId: UserId): boolean {
  return userId === ADMIN_USER_ID;
}

export function assertAdminUserId(value: unknown): UserId {
  const userId = assertUserId(value);

  if (!isAdminUserId(userId)) {
    throw new ValidationError("ADMIN_REQUIRED", "只有管理员可以访问这个后台。");
  }

  return userId;
}

export function isGameType(value: unknown): value is GameType {
  return value === "rps" || value === "telepathy" || value === "guess-number" || value === "charades";
}

export function assertGameType(value: unknown): GameType {
  if (!isGameType(value)) {
    throw new ValidationError("INVALID_GAME_TYPE", "小游戏类型不合法。");
  }

  return value;
}

export function isRpsChoice(value: unknown): value is RpsChoice {
  return value === "rock" || value === "paper" || value === "scissors";
}

export function assertRpsChoice(value: unknown): RpsChoice {
  if (!isRpsChoice(value)) {
    throw new ValidationError("INVALID_CHOICE", "猜拳选项只能是 rock、paper 或 scissors。");
  }

  return value;
}

export function assertInteger(value: unknown, code: string, message: string): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(numeric)) {
    throw new ValidationError(code, message);
  }

  return numeric;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError("INVALID_JSON", "请求体不是合法 JSON。");
  }
}

export function cloneRoundState(round: PersistedRoundState): PersistedRoundState {
  const safeOptions = Array.isArray(round.options) ? round.options : [];

  return {
    choices: { ...INITIAL_ROUND_STATE.choices, ...(round.choices ?? {}) },
    completedAt: round.completedAt ?? INITIAL_ROUND_STATE.completedAt,
    describerId: round.describerId ?? INITIAL_ROUND_STATE.describerId,
    gameType: round.gameType ?? INITIAL_ROUND_STATE.gameType,
    guesserId: round.guesserId ?? INITIAL_ROUND_STATE.guesserId,
    max: round.max ?? INITIAL_ROUND_STATE.max,
    min: round.min ?? INITIAL_ROUND_STATE.min,
    options: safeOptions.map((option) => ({ ...option })),
    promptText: round.promptText ?? INITIAL_ROUND_STATE.promptText,
    roundId: round.roundId ?? INITIAL_ROUND_STATE.roundId,
    secretCategory: round.secretCategory ?? INITIAL_ROUND_STATE.secretCategory,
    secretDifficulty: round.secretDifficulty ?? INITIAL_ROUND_STATE.secretDifficulty,
    secretWord: round.secretWord ?? INITIAL_ROUND_STATE.secretWord,
    startedAt: round.startedAt ?? INITIAL_ROUND_STATE.startedAt,
    status: round.status ?? INITIAL_ROUND_STATE.status,
    summary: round.summary ?? INITIAL_ROUND_STATE.summary,
    target: round.target ?? INITIAL_ROUND_STATE.target,
    winnerId: round.winnerId ?? INITIAL_ROUND_STATE.winnerId,
  };
}

export function toRoundSnapshot(round: PersistedRoundState, viewerId?: UserId): RoundSnapshot {
  const choicesSubmitted = Object.keys(round.choices).filter(isUserId);
  const revealedChoices: Partial<Record<UserId, string>> = {};
  const canSeeSecret = Boolean(viewerId && round.describerId === viewerId);

  if (round.status === "resolved") {
    for (const userId of choicesSubmitted) {
      const rawChoice = round.choices[userId];

      if (rawChoice === undefined) {
        continue;
      }

      revealedChoices[userId] = formatChoiceForDisplay(round.gameType, rawChoice, round.options);
    }
  }

  return {
    choicesSubmitted,
    completedAt: round.completedAt,
    describerId: round.describerId,
    gameType: round.gameType,
    guesserId: round.guesserId,
    max: round.max,
    min: round.min,
    options: round.options.map((option) => ({ ...option })),
    promptText: round.promptText,
    revealedChoices,
    roundId: round.roundId,
    secretCategory: canSeeSecret || round.status === "resolved" ? round.secretCategory : null,
    secretDifficulty: canSeeSecret || round.status === "resolved" ? round.secretDifficulty : null,
    secretWord: canSeeSecret || round.status === "resolved" ? round.secretWord : null,
    startedAt: round.startedAt,
    status: round.status,
    summary: round.summary,
    target: round.status === "resolved" ? round.target : null,
    winnerId: round.status === "resolved" ? round.winnerId : null,
  };
}

export function getInternalRoomUrl(pathname: string): string {
  return `https://${FIXED_ROOM_ID}${pathname}`;
}

export function boolFromSql(value: unknown): boolean {
  return Number(value) === 1;
}

export function choiceLabel(choice: RpsChoice): string {
  return RPS_OPTIONS.find((item) => item.id === choice)?.label ?? choice;
}

export function gameTypeLabel(gameType: GameType): string {
  return getGameCatalogItem(gameType).label;
}

export function getGameCatalogItem(gameType: GameType): GameCatalogItem {
  return GAME_CATALOG.find((item) => item.type === gameType) ?? GAME_CATALOG[0];
}

export function userLabel(userId: UserId): string {
  return USER_DIRECTORY[userId].displayName;
}

export function userRoleLabel(role: UserRole): string {
  return role === "admin" ? "管理员" : "普通用户";
}

export function userAvatar(userId: UserId): string {
  return USER_DIRECTORY[userId].avatar;
}

export function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new ValidationError("EMPTY_SOURCE", "没有可用的数据可以随机选择。");
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] as T;
}

export function formatChoiceForDisplay(
  gameType: GameType,
  rawChoice: string | number,
  options: TelepathyOption[] = [],
): string {
  if (gameType === "rps") {
    return choiceLabel(assertRpsChoice(rawChoice));
  }

  if (gameType === "telepathy") {
    return options.find((option) => option.id === rawChoice)?.label ?? String(rawChoice);
  }

  if (gameType === "charades") {
    return String(rawChoice) === "__ready__" ? "描述就位" : String(rawChoice);
  }

  return String(rawChoice);
}

export function normalizeGuessText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
