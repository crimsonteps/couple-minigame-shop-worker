export type UserId = "yzy" | "wh";
export type UserRole = "admin" | "player";
export type RoomId = "couple-home";
export type GameType = "rps" | "telepathy" | "guess-number";
export type RpsChoice = "rock" | "paper" | "scissors";
export type RoundStatus = "idle" | "collecting" | "resolved";
export type RoundChoiceValue = string | number;

export type ScoreBoard = Record<UserId, number>;
export type OnlineStatus = Record<UserId, boolean>;

export interface UserProfile {
  id: UserId;
  displayName: string;
  score: number;
  online: boolean;
  role: UserRole;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  stock: number;
  emoji: string;
  active: boolean;
  priceHint: string;
}

export interface TelepathyOption {
  id: string;
  label: string;
}

export interface TelepathyPrompt {
  id: string;
  options: TelepathyOption[];
  text: string;
}

export interface GameCatalogItem {
  description: string;
  emoji: string;
  label: string;
  subtitle: string;
  type: GameType;
}

export interface GameRecord {
  id: number;
  roomId: RoomId;
  gameType: GameType;
  playedAt: string;
  players: [UserId, UserId];
  choices: Record<UserId, string>;
  winnerId: UserId | null;
  summary: string;
  detailLines: string[];
  scoreDelta: ScoreBoard;
}

export interface RedemptionRecord {
  id: number;
  roomId: RoomId;
  itemId: string;
  itemName: string;
  userId: UserId;
  cost: number;
  createdAt: string;
}

export interface GiftCard {
  id: number;
  itemId: string;
  itemName: string;
  emoji: string;
  description: string;
  cost: number;
  createdAt: string;
  ownerId: UserId;
  serial: string;
}

export interface PersistedRoundState {
  roundId: number;
  gameType: GameType;
  status: RoundStatus;
  startedAt: string | null;
  completedAt: string | null;
  choices: Partial<Record<UserId, RoundChoiceValue>>;
  winnerId: UserId | null;
  summary: string;
  promptText: string | null;
  options: TelepathyOption[];
  min: number | null;
  max: number | null;
  target: number | null;
}

export interface RoundSnapshot {
  roundId: number;
  gameType: GameType;
  status: RoundStatus;
  startedAt: string | null;
  completedAt: string | null;
  choicesSubmitted: UserId[];
  revealedChoices: Partial<Record<UserId, string>>;
  winnerId: UserId | null;
  summary: string;
  promptText: string | null;
  options: TelepathyOption[];
  min: number | null;
  max: number | null;
  target: number | null;
}

export interface DashboardSnapshot {
  roomId: RoomId;
  users: UserProfile[];
  scores: ScoreBoard;
  online: OnlineStatus;
  currentRound: RoundSnapshot;
  recentGames: GameRecord[];
  recentRedemptions: RedemptionRecord[];
  shopItems: ShopItem[];
  serverTime: string;
}

export interface ShopPageData {
  users: UserProfile[];
  scores: ScoreBoard;
  shopItems: ShopItem[];
  recentRedemptions: RedemptionRecord[];
  serverTime: string;
}

export interface RecordsPageData {
  users: UserProfile[];
  scores: ScoreBoard;
  recentGames: GameRecord[];
  recentRedemptions: RedemptionRecord[];
  serverTime: string;
}

export interface HealthCheckData {
  ok: boolean;
  roomId: RoomId;
  onlineCount: number;
  currentRoundStatus: RoundStatus;
  serverTime: string;
  schemaVersion: number;
}

export interface AdminPageData {
  actingUser: UserProfile;
  serverTime: string;
  shopItems: ShopItem[];
  users: UserProfile[];
}

export interface ProfilePageData {
  giftCards: GiftCard[];
  serverTime: string;
  user: UserProfile;
}

export interface GameResolution {
  winnerId: UserId | null;
  summary: string;
  scoreDelta: ScoreBoard;
  recordedChoices: Record<UserId, string>;
  detailLines: string[];
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
