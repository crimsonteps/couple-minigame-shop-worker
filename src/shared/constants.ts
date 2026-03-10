import type { GameCatalogItem, PersistedRoundState, TelepathyPrompt, UserId } from "./types";

export const PROJECT_NAME = "Oh Kanh Mini Game";
export const FIXED_ROOM_ID = "couple-home";
export const FIXED_USER_IDS = ["yzy", "wh"] as const;
export const PRIMARY_USER_ID = FIXED_USER_IDS[0];
export const SECONDARY_USER_ID = FIXED_USER_IDS[1];
export const ADMIN_USER_ID: UserId = "yzy";
export const LEGACY_USER_ID_MAP = {
  u1: "yzy",
  u2: "wh",
} as const;
export const USER_DIRECTORY: Record<UserId, { avatar: string; displayName: string; role: "admin" | "player" }> = {
  wh: {
    avatar: "💞",
    displayName: "wh",
    role: "player",
  },
  yzy: {
    avatar: "🫶",
    displayName: "yzy",
    role: "admin",
  },
};
export const WIN_POINTS = 6;
export const DRAW_POINTS = 2;
export const TELEPATHY_MATCH_POINTS = 5;
export const TELEPATHY_PARTICIPATION_POINTS = 2;
export const GUESS_NUMBER_WIN_POINTS = 7;
export const GUESS_NUMBER_DRAW_POINTS = 3;
export const CHARADES_SUCCESS_POINTS = 8;
export const DEFAULT_RECENT_LIMIT = 8;
export const DEFAULT_GUESS_RANGE = {
  max: 20,
  min: 1,
} as const;

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    description: "同时出拳，赢的人加分。",
    emoji: "✊",
    label: "猜拳",
    subtitle: `赢 +${WIN_POINTS}，平 +${DRAW_POINTS}`,
    type: "rps",
  },
  {
    description: "选同一个答案就一起得分。",
    emoji: "💭",
    label: "默契问答",
    subtitle: `对上 +${TELEPATHY_MATCH_POINTS}`,
    type: "telepathy",
  },
  {
    description: `猜 ${DEFAULT_GUESS_RANGE.min}-${DEFAULT_GUESS_RANGE.max} 的数字，谁更近谁得分。`,
    emoji: "🔢",
    label: "猜数字",
    subtitle: `更近 +${GUESS_NUMBER_WIN_POINTS}，同近 +${GUESS_NUMBER_DRAW_POINTS}`,
    type: "guess-number",
  },
  {
    description: "系统发一个词，一人描述，另一人来猜。",
    emoji: "🎭",
    label: "你比我猜",
    subtitle: `猜中双方各 +${CHARADES_SUCCESS_POINTS}`,
    type: "charades",
  },
];

export const RPS_OPTIONS = [
  { emoji: "✊", id: "rock", label: "石头" },
  { emoji: "✋", id: "paper", label: "布" },
  { emoji: "✌️", id: "scissors", label: "剪刀" },
] as const;

export const INITIAL_ROUND_STATE: PersistedRoundState = {
  choices: {},
  completedAt: null,
  gameType: "rps",
  max: null,
  min: null,
  options: [],
  promptText: null,
  roundId: 0,
  startedAt: null,
  status: "idle",
  summary: "先选一个游戏。",
  target: null,
  winnerId: null,
  describerId: null,
  guesserId: null,
  secretWord: null,
  secretCategory: null,
  secretDifficulty: null,
};

export const TELEPATHY_PROMPTS: TelepathyPrompt[] = [
  {
    id: "weekend-date",
    options: [
      { id: "cafe", label: "去咖啡店慢慢聊天" },
      { id: "walk", label: "散步看夜景" },
      { id: "movie", label: "一起看电影" },
      { id: "home", label: "点外卖窝在家" },
    ],
    text: "如果这个周末突然空出半天，你更想怎么约会？",
  },
  {
    id: "comfort-mode",
    options: [
      { id: "hug", label: "被抱一下就好" },
      { id: "voice", label: "听一段安慰语音" },
      { id: "snack", label: "吃点喜欢的小零食" },
      { id: "milk-tea", label: "来一杯奶茶回血" },
    ],
    text: "如果今天有点累，你最想收到哪种安慰方式？",
  },
  {
    id: "anniversary-surprise",
    options: [
      { id: "letter", label: "手写小卡片" },
      { id: "cake", label: "小蛋糕庆祝" },
      { id: "flower", label: "一束小花" },
      { id: "dinner", label: "出去吃顿好吃的" },
    ],
    text: "如果是纪念日，你觉得哪种小惊喜最戳心？",
  },
  {
    id: "rainy-day",
    options: [
      { id: "sleep", label: "裹着被子睡觉" },
      { id: "series", label: "一起追剧" },
      { id: "soup", label: "出门吃热汤面" },
      { id: "umbrella", label: "撑伞散步" },
    ],
    text: "如果外面下雨了，你最想和对方一起做什么？",
  },
  {
    id: "travel-gap",
    options: [
      { id: "photos", label: "拍照打卡" },
      { id: "coffee", label: "钻进小店喝咖啡" },
      { id: "market", label: "慢慢逛小店" },
      { id: "bench", label: "找个地方坐着聊天" },
    ],
    text: "旅行时临时多出一小时，你更想把时间花在哪里？",
  },
  {
    id: "midnight-snack",
    options: [
      { id: "fruit", label: "清爽水果" },
      { id: "cake", label: "小蛋糕" },
      { id: "bbq", label: "香香烧烤" },
      { id: "porridge", label: "热乎乎的粥" },
    ],
    text: "如果深夜突然有点饿，你第一反应会想吃什么？",
  },
];

export const SHOP_ITEM_SEEDS = [
  {
    cost: 18,
    description: "一杯奶茶。",
    emoji: "🧋",
    id: "milk-tea",
    name: "奶茶",
    priceHint: "参考价约 ￥18-25",
    sortOrder: 1,
    stock: 20,
  },
  {
    cost: 26,
    description: "一个小蛋糕。",
    emoji: "🍰",
    id: "small-cake",
    name: "小蛋糕",
    priceHint: "参考价约 ￥22-38",
    sortOrder: 2,
    stock: 12,
  },
  {
    cost: 14,
    description: "兑换一个抱抱。",
    emoji: "🤗",
    id: "hug-coupon",
    name: "抱抱券",
    priceHint: "零成本但很值钱",
    sortOrder: 3,
    stock: 50,
  },
  {
    cost: 36,
    description: "晚餐多一道菜。",
    emoji: "🍲",
    id: "dinner-upgrade",
    name: "晚餐加菜券",
    priceHint: "加一道菜约 ￥15-30",
    sortOrder: 4,
    stock: 10,
  },
  {
    cost: 14,
    description: "一支润唇膏。",
    emoji: "💄",
    id: "lip-balm",
    name: "润唇膏",
    priceHint: "搜索价约 ￥29.9",
    sortOrder: 5,
    stock: 18,
  },
  {
    cost: 12,
    description: "一支护手霜。",
    emoji: "🧴",
    id: "hand-cream",
    name: "护手霜",
    priceHint: "搜索价约 ￥19.9",
    sortOrder: 6,
    stock: 18,
  },
  {
    cost: 22,
    description: "一盒巧克力。",
    emoji: "🍫",
    id: "chocolate-box",
    name: "巧克力小礼盒",
    priceHint: "搜索价约 ￥59.9",
    sortOrder: 7,
    stock: 12,
  },
  {
    cost: 8,
    description: "一个钥匙扣。",
    emoji: "🗝️",
    id: "cute-keychain",
    name: "可爱钥匙扣",
    priceHint: "搜索价约 ￥9.9",
    sortOrder: 8,
    stock: 24,
  },
  {
    cost: 6,
    description: "一包暖暖贴。",
    emoji: "🔥",
    id: "warm-pack",
    name: "暖暖贴小包",
    priceHint: "搜索价约 ￥1-5",
    sortOrder: 9,
    stock: 30,
  },
] as const;
