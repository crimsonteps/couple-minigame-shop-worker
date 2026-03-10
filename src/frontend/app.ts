import {
  ADMIN_USER_ID,
  DEFAULT_GUESS_RANGE,
  FIXED_USER_IDS,
  GAME_CATALOG,
  PRIMARY_USER_ID,
  PROJECT_NAME,
  SECONDARY_USER_ID,
  TELEPATHY_PROMPTS,
  RPS_OPTIONS,
  USER_DIRECTORY,
} from "../shared/constants";
import type { ServerMessage } from "../shared/protocol";
import type {
  AdminPageData,
  ApiResponse,
  DashboardSnapshot,
  GiftCard,
  GameRecord,
  GameType,
  OnlineStatus,
  ProfilePageData,
  RecordsPageData,
  RedemptionRecord,
  RoundSnapshot,
  ShopItem,
  ShopPageData,
  UserId,
  UserProfile,
} from "../shared/types";
import { gameTypeLabel, isAdminUserId, normalizeUserId, userAvatar, userLabel } from "../shared/utils";

const USER_STORAGE_KEY = "couple-home.current-user";
const GAME_STORAGE_KEY = "couple-home.selected-game";
const THEME_STORAGE_KEY = "couple-home.theme";
const RECONNECT_DELAY_MS = 3000;
const page = (document.body.dataset.page ?? "dashboard") as
  | "choose"
  | "dashboard"
  | "games"
  | "shop"
  | "records"
  | "profile"
  | "admin";
type ThemeMode = "light" | "dark";

interface ClientState {
  adminData: AdminPageData | null;
  charadesGuessDraft: string;
  currentUser: UserId;
  dashboard: DashboardSnapshot | null;
  guessNumberDraft: string;
  pokedUserId: UserId | null;
  pokeTimer: number | null;
  profileData: ProfilePageData | null;
  recordsData: RecordsPageData | null;
  reconnectTimer: number | null;
  selectedGameType: GameType;
  shopData: ShopPageData | null;
  socket: WebSocket | null;
  socketVersion: number;
  theme: ThemeMode;
  toastTimer: number | null;
}

const state: ClientState = {
  adminData: null,
  charadesGuessDraft: "",
  currentUser: loadStoredUser(),
  dashboard: null,
  guessNumberDraft: "",
  pokedUserId: null,
  pokeTimer: null,
  profileData: null,
  recordsData: null,
  reconnectTimer: null,
  selectedGameType: loadSelectedGameType(),
  shopData: null,
  socket: null,
  socketVersion: 0,
  theme: loadTheme(),
  toastTimer: null,
};

applyTheme(state.theme);
void init();

async function init(): Promise<void> {
  bindCommonEvents();
  updateThemeToggle();

  if (page === "choose") {
    renderChoosePage();
    return;
  }

  const userFromUrl = getUserFromUrl();

  if (!userFromUrl) {
    redirectToChoosePage();
    return;
  }

  state.currentUser = userFromUrl;
  localStorage.setItem(USER_STORAGE_KEY, userFromUrl);
  syncNavLinks();
  updateCurrentUserDisplay();

  if (page === "dashboard") {
    redirectToGamesPage(state.currentUser);
    return;
  }

  if (page === "admin" && !isCurrentUserAdmin()) {
    redirectToHomePage(state.currentUser);
    return;
  }

  if (page !== "admin") {
    setSocketStatus("正在连接", "connecting");
  }

  try {
    await loadInitialData();
    render();
  } catch (error) {
    showToast(normalizeError(error), "warning");
  }

  if (page !== "admin") {
    connectSocket();
  }
}

function bindCommonEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme(state.theme);
      saveTheme(state.theme);
      updateThemeToggle();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-choose-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = normalizeUserId(button.dataset.chooseUser);

      if (!userId) {
        return;
      }

      enterWithUser(userId);
    });
  });

  document.getElementById("game-selector")?.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-game-select]");

    if (!button) {
      return;
    }

    const nextGameType = button.dataset.gameSelect;

    if (nextGameType !== "rps" && nextGameType !== "telepathy" && nextGameType !== "guess-number" && nextGameType !== "charades") {
      return;
    }

    const round = getCurrentRound();

    if (round.status === "collecting") {
      return;
    }

    state.selectedGameType = nextGameType;
    localStorage.setItem(GAME_STORAGE_KEY, nextGameType);
    renderGameArea();
  });

  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    sendSocketMessage({
      gameType: getDisplayedGameType(),
      type: "game:start",
    });
  });

  document.getElementById("force-end-game-btn")?.addEventListener("click", () => {
    sendSocketMessage({
      type: "game:force-end",
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-poke-user]");

    if (!button) {
      return;
    }

    const targetUserId = normalizeUserId(button.dataset.pokeUser);

    if (!targetUserId || targetUserId === state.currentUser) {
      return;
    }

    triggerPokeVisual(targetUserId);

    const targetUser = getUsers().find((user) => user.id === targetUserId);

    if (targetUser?.online) {
      sendSocketMessage({
        targetUserId,
        type: "user:poke",
      });
      return;
    }

    showToast(`${targetUserId} 还没到，先帮你轻轻催一下。`);
  });

  document.getElementById("game-panel")?.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const rpsButton = target.closest<HTMLButtonElement>("[data-rps-choice]");

    if (rpsButton) {
      const choice = rpsButton.dataset.rpsChoice;

      if (choice !== "rock" && choice !== "paper" && choice !== "scissors") {
        return;
      }

      sendSocketMessage({
        choice,
        type: "rps:choice",
      });
      return;
    }

    const telepathyButton = target.closest<HTMLButtonElement>("[data-telepathy-option]");

    if (telepathyButton) {
      const optionId = telepathyButton.dataset.telepathyOption;

      if (!optionId) {
        return;
      }

      sendSocketMessage({
        optionId,
        type: "telepathy:choice",
      });
      return;
    }

    const charadesReadyButton = target.closest<HTMLButtonElement>("[data-charades-ready]");

    if (charadesReadyButton) {
      sendSocketMessage({
        type: "charades:ready",
      });
    }
  });

  document.getElementById("game-panel")?.addEventListener("input", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.hasAttribute("data-guess-number-input")) {
      state.guessNumberDraft = target.value;
      return;
    }

    if (target.hasAttribute("data-charades-input")) {
      state.charadesGuessDraft = target.value;
    }
  });

  document.getElementById("game-panel")?.addEventListener("submit", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLFormElement)) {
      return;
    }

    if (target.hasAttribute("data-charades-form")) {
      event.preventDefault();

      const input = target.querySelector<HTMLInputElement>("[data-charades-input]");

      if (!input) {
        return;
      }

      const guess = input.value.trim();

      if (!guess) {
        showToast("请输入你猜到的词。", "warning");
        return;
      }

      state.charadesGuessDraft = guess;
      sendSocketMessage({
        guess,
        type: "charades:guess",
      });
      return;
    }

    if (!target.hasAttribute("data-guess-number-form")) {
      return;
    }

    event.preventDefault();

    const input = target.querySelector<HTMLInputElement>("[data-guess-number-input]");

    if (!input) {
      return;
    }

    const rawValue = input.value.trim();

    if (!rawValue) {
      showToast("请输入整数。", "warning");
      return;
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value)) {
      showToast("请输入整数。", "warning");
      return;
    }

    state.guessNumberDraft = rawValue;
    sendSocketMessage({
      type: "guess-number:submit",
      value,
    });
  });

  document.getElementById("shop-grid")?.addEventListener("click", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-redeem-item]");

    if (!button) {
      return;
    }

    const itemId = button.dataset.redeemItem;

    if (!itemId) {
      return;
    }

    button.disabled = true;

    try {
      const result = await apiRequest<{ item: ShopItem; redemption: RedemptionRecord; snapshot: DashboardSnapshot }>(
        "/api/shop/redeem",
        {
          body: JSON.stringify({
            itemId,
            userId: state.currentUser,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );

      state.dashboard = result.snapshot;
      render();
      showToast(`兑换成功：${result.redemption.itemName}。`, "success");
    } catch (error) {
      showToast(normalizeError(error), "warning");
      render();
    }
  });

  document.addEventListener("submit", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLFormElement)) {
      return;
    }

    if (target.hasAttribute("data-user-score-form")) {
      event.preventDefault();
      await submitUserScoreForm(target);
      return;
    }

    if (target.hasAttribute("data-shop-create-form")) {
      event.preventDefault();
      await submitShopCreateForm(target);
      return;
    }

    if (target.hasAttribute("data-shop-update-form")) {
      event.preventDefault();
      await submitShopUpdateForm(target);
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-shop-delete-item]");

    if (!button) {
      return;
    }

    const itemId = button.dataset.shopDeleteItem;

    if (!itemId) {
      return;
    }

    button.disabled = true;

    try {
      state.adminData = await apiRequest<AdminPageData>("/api/admin/shop/delete", {
        body: JSON.stringify({
          actingUserId: state.currentUser,
          itemId,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      render();
      showToast("商品已停用。", "success");
    } catch (error) {
      showToast(normalizeError(error), "warning");
      button.disabled = false;
    }
  });
}

async function loadInitialData(): Promise<void> {
  if (page === "admin") {
    state.adminData = await apiRequest<AdminPageData>(`/api/admin?user=${state.currentUser}`);
    return;
  }

  if (page === "dashboard") {
    state.dashboard = await apiRequest<DashboardSnapshot>(`/api/dashboard?user=${state.currentUser}`);
    syncGameSelectionFromSnapshot(state.dashboard.currentRound);
    return;
  }

  if (page === "games") {
    state.dashboard = await apiRequest<DashboardSnapshot>(`/api/dashboard?user=${state.currentUser}`);
    syncGameSelectionFromSnapshot(state.dashboard.currentRound);
    return;
  }

  if (page === "shop") {
    state.shopData = await apiRequest<ShopPageData>("/api/shop");
    return;
  }

  if (page === "profile") {
    state.profileData = await apiRequest<ProfilePageData>(`/api/profile?user=${state.currentUser}`);
    return;
  }

  state.recordsData = await apiRequest<RecordsPageData>("/api/records");
}

function connectSocket(): void {
  state.socketVersion += 1;
  const currentVersion = state.socketVersion;

  if (state.reconnectTimer !== null) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.close(1000, "Switching session.");
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws?user=${state.currentUser}`);
  state.socket = socket;
  setSocketStatus("正在连接", "connecting");

  socket.addEventListener("open", () => {
    if (state.socketVersion !== currentVersion) {
      socket.close(1000, "Stale connection.");
      return;
    }

    setSocketStatus("实时联机中", "online");
    sendSocketMessage({ type: "dashboard:sync" });
  });

  socket.addEventListener("message", (event) => {
    if (state.socketVersion !== currentVersion) {
      return;
    }

    handleSocketMessage(event.data);
  });

  socket.addEventListener("close", () => {
    if (state.socketVersion !== currentVersion) {
      return;
    }

    setSocketStatus("连接断开，准备重连", "connecting");
    state.reconnectTimer = window.setTimeout(() => {
      connectSocket();
    }, RECONNECT_DELAY_MS);
  });

  socket.addEventListener("error", () => {
    if (state.socketVersion !== currentVersion) {
      return;
    }

    setSocketStatus("连接异常", "connecting");
  });
}

function handleSocketMessage(rawMessage: string): void {
  let message: ServerMessage;

  try {
    message = JSON.parse(rawMessage) as ServerMessage;
  } catch {
    return;
  }

  if (message.type === "snapshot") {
    state.dashboard = message.payload;

    const currentRound = message.payload.currentRound;
    if (
      currentRound.gameType !== "guess-number" ||
      currentRound.status !== "collecting" ||
      currentRound.choicesSubmitted.includes(state.currentUser)
    ) {
      state.guessNumberDraft = "";
    }

    if (
      currentRound.gameType !== "charades" ||
      currentRound.status !== "collecting" ||
      currentRound.choicesSubmitted.includes(state.currentUser)
    ) {
      state.charadesGuessDraft = "";
    }

    syncGameSelectionFromSnapshot(currentRound);
    render();
    return;
  }

  if (message.type === "notice") {
    if ((page === "dashboard" || page === "games") && message.payload.text.includes("心动提醒")) {
      triggerPokeVisual(state.currentUser);
    }
    showToast(message.payload.text, message.payload.level === "info" ? undefined : message.payload.level);
    return;
  }

  showToast(message.payload.message, "warning");
}

function sendSocketMessage(message: object): void {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    showToast("实时连接还没准备好，请稍后再试。", "warning");
    return;
  }

  state.socket.send(JSON.stringify(message));
}

function render(): void {
  if (page === "choose") {
    renderChoosePage();
    return;
  }

  updateCurrentUserDisplay();
  renderNavLinks();

  if (page === "dashboard") {
    renderDashboardPage();
    return;
  }

  if (page === "games") {
    renderGamesPage();
    return;
  }

  if (page === "shop") {
    renderShopPage();
    return;
  }

  if (page === "admin") {
    renderAdminPage();
    return;
  }

  if (page === "profile") {
    renderProfilePage();
    return;
  }

  renderRecordsPage();
}

function renderChoosePage(): void {
  const title = document.getElementById("choose-page-title");
  const subtitle = document.getElementById("choose-page-subtitle");
  const hint = document.getElementById("choose-last-user");

  if (title) {
    title.textContent = PROJECT_NAME;
  }

  if (subtitle) {
    subtitle.textContent = "选一个身份进入。";
  }

  if (hint) {
    hint.textContent = `上次：${state.currentUser}`;
  }

  document.querySelectorAll<HTMLElement>("[data-choose-user]").forEach((card) => {
    card.classList.toggle("active", card.getAttribute("data-choose-user") === state.currentUser);
  });
}

function renderDashboardPage(): void {
  const users = getUsers();
  updateDashboardMood(users);
  renderScoreGrid(document.getElementById("score-grid"), users);
  renderServerTime(document.getElementById("server-time"), getServerTime());
  renderGamesList(document.getElementById("recent-games-list"), getRecentGames());
  renderRedemptionsList(document.getElementById("recent-redemptions-list"), getRecentRedemptions());
}

function renderGamesPage(): void {
  const users = getUsers();
  renderScoreGrid(document.getElementById("games-score-grid"), users);
  renderServerTime(document.getElementById("games-server-time"), getServerTime());
  renderGameArea();
}

function renderAdminPage(): void {
  renderServerTime(document.getElementById("admin-server-time"), getServerTime());

  const userGrid = document.getElementById("admin-users-grid");
  const itemGrid = document.getElementById("admin-shop-grid");
  const users = getUsers();
  const items = state.adminData?.shopItems ?? [];

  if (userGrid) {
    userGrid.innerHTML = users
      .map(
        (user) => `
          <article class="admin-card">
            <div class="admin-card-head">
              <div class="score-label">
                <span class="avatar-badge">${userAvatar(user.id)}</span>
                <div>
                  <p class="eyebrow">${escapeHtml(user.id)}</p>
                  <h3>${escapeHtml(user.displayName)}</h3>
                </div>
              </div>
            </div>
            <form class="admin-form" data-user-score-form>
              <input type="hidden" name="userId" value="${escapeHtml(user.id)}" />
              <label class="field-label">
                <span>当前积分</span>
                <input class="admin-input" type="number" min="0" step="1" name="score" value="${user.score}" />
              </label>
              <button class="primary-button compact" type="submit">保存积分</button>
            </form>
          </article>
        `,
      )
      .join("");
  }

  if (itemGrid) {
    itemGrid.innerHTML = `
      <form class="admin-card admin-form admin-create-card" data-shop-create-form>
        <div class="section-head compact">
          <div>
            <p class="eyebrow">新商品</p>
            <h3>新增礼物</h3>
          </div>
        </div>
        ${renderAdminItemFields()}
        <button class="primary-button" type="submit">创建商品</button>
      </form>
      <div class="admin-shop-list">
        <div class="admin-shop-table-head">
          <span>商品</span>
          <span>ID</span>
          <span>名称</span>
          <span>图标</span>
          <span>积分</span>
          <span>库存</span>
          <span>参考价</span>
          <span>描述</span>
          <span>显示</span>
          <span>操作</span>
        </div>
        ${items.map((item) => renderAdminShopCard(item)).join("")}
      </div>
    `;
  }
}

function renderAdminShopCard(item: ShopItem): string {
  return `
    <form class="admin-card admin-form admin-shop-row" data-shop-update-form>
      <div class="admin-shop-row-grid">
        <div class="admin-shop-cell admin-shop-title">
          <span class="shop-emoji">${escapeHtml(item.emoji)}</span>
          <span>${escapeHtml(item.name)}</span>
        </div>
        <label class="field-label">
          <span class="admin-mobile-label">ID</span>
          <input class="admin-input" name="id" value="${escapeHtml(item.id)}" readonly />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">名称</span>
          <input class="admin-input" name="name" value="${escapeHtml(item.name)}" />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">图标</span>
          <input class="admin-input" name="emoji" value="${escapeHtml(item.emoji)}" />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">积分</span>
          <input class="admin-input" type="number" min="0" step="1" name="cost" value="${item.cost}" />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">库存</span>
          <input class="admin-input" type="number" min="0" step="1" name="stock" value="${item.stock}" />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">参考价</span>
          <input class="admin-input" name="priceHint" value="${escapeHtml(item.priceHint)}" />
        </label>
        <label class="field-label">
          <span class="admin-mobile-label">描述</span>
          <input class="admin-input" name="description" value="${escapeHtml(item.description)}" />
        </label>
        <label class="admin-toggle admin-shop-switch">
          <span class="admin-mobile-label">显示</span>
          <input type="checkbox" name="active" ${item.active ? "checked" : ""} />
          <span>${item.active ? "开" : "关"}</span>
        </label>
      </div>
      <div class="admin-actions">
        <button class="primary-button compact" type="submit">保存商品</button>
        <button class="danger-button" type="button" data-shop-delete-item="${escapeHtml(item.id)}">停用商品</button>
      </div>
    </form>
  `;
}

function renderAdminItemFields(item?: ShopItem): string {
  return `
    <div class="admin-field-grid">
      <label class="field-label">
        <span>商品 ID</span>
        <input class="admin-input" name="id" value="${escapeHtml(item?.id ?? "")}" ${item ? "readonly" : ""} />
      </label>
      <label class="field-label">
        <span>名称</span>
        <input class="admin-input" name="name" value="${escapeHtml(item?.name ?? "")}" />
      </label>
      <label class="field-label">
        <span>图标</span>
        <input class="admin-input" name="emoji" value="${escapeHtml(item?.emoji ?? "")}" />
      </label>
      <label class="field-label">
        <span>积分价格</span>
        <input class="admin-input" type="number" min="0" step="1" name="cost" value="${item?.cost ?? 0}" />
      </label>
      <label class="field-label">
        <span>库存</span>
        <input class="admin-input" type="number" min="0" step="1" name="stock" value="${item?.stock ?? 0}" />
      </label>
      <label class="field-label">
        <span>参考价</span>
        <input class="admin-input" name="priceHint" value="${escapeHtml(item?.priceHint ?? "")}" />
      </label>
      <label class="field-label field-label-full">
        <span>描述</span>
        <textarea class="admin-textarea" name="description" rows="3">${escapeHtml(item?.description ?? "")}</textarea>
      </label>
      ${
        item
          ? `
            <label class="admin-toggle">
              <input type="checkbox" name="active" ${item.active ? "checked" : ""} />
              <span>前台可见</span>
            </label>
          `
          : ""
      }
    </div>
  `;
}

async function submitUserScoreForm(form: HTMLFormElement): Promise<void> {
  const submitButton = form.querySelector<HTMLButtonElement>('[type="submit"]');
  const formData = new FormData(form);

  submitButton?.setAttribute("disabled", "disabled");

  try {
    state.adminData = await apiRequest<AdminPageData>("/api/admin/users/score", {
      body: JSON.stringify({
        actingUserId: state.currentUser,
        score: Number(formData.get("score") ?? 0),
        userId: String(formData.get("userId") ?? ""),
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    render();
    showToast("积分已更新。", "success");
  } catch (error) {
    showToast(normalizeError(error), "warning");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
}

async function submitShopCreateForm(form: HTMLFormElement): Promise<void> {
  const submitButton = form.querySelector<HTMLButtonElement>('[type="submit"]');
  const payload = readAdminShopForm(form);

  submitButton?.setAttribute("disabled", "disabled");

  try {
    state.adminData = await apiRequest<AdminPageData>("/api/admin/shop/create", {
      body: JSON.stringify({
        actingUserId: state.currentUser,
        ...payload,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    form.reset();
    render();
    showToast("商品已创建。", "success");
  } catch (error) {
    showToast(normalizeError(error), "warning");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
}

async function submitShopUpdateForm(form: HTMLFormElement): Promise<void> {
  const submitButton = form.querySelector<HTMLButtonElement>('[type="submit"]');
  const payload = readAdminShopForm(form);

  submitButton?.setAttribute("disabled", "disabled");

  try {
    state.adminData = await apiRequest<AdminPageData>("/api/admin/shop/update", {
      body: JSON.stringify({
        actingUserId: state.currentUser,
        active: new FormData(form).has("active"),
        ...payload,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    render();
    showToast("商品已更新。", "success");
  } catch (error) {
    showToast(normalizeError(error), "warning");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
}

function readAdminShopForm(form: HTMLFormElement): {
  cost: number;
  description: string;
  emoji: string;
  id: string;
  name: string;
  priceHint: string;
  stock: number;
} {
  const formData = new FormData(form);

  return {
    cost: Number(formData.get("cost") ?? 0),
    description: String(formData.get("description") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    priceHint: String(formData.get("priceHint") ?? ""),
    stock: Number(formData.get("stock") ?? 0),
  };
}

function renderShopPage(): void {
  renderServerTime(document.getElementById("shop-server-time"), getServerTime());
  const currentScore = getCurrentUserScore();
  const balancePill = document.getElementById("shop-balance-pill");

  if (balancePill) {
    balancePill.textContent = `${state.currentUser} · ${currentScore} 分`;
  }

  const shopGrid = document.getElementById("shop-grid");

  if (shopGrid) {
    const items = getShopItems();

    if (!items.length) {
      shopGrid.innerHTML = `<div class="empty-card">还没有礼物。</div>`;
    } else {
      shopGrid.innerHTML = items
        .map((item) => {
          const disabled = item.stock <= 0 || currentScore < item.cost;
          const buttonText = item.stock <= 0 ? "已兑完" : currentScore < item.cost ? "积分不够" : "立即兑换";

          return `
            <article class="shop-card">
              <div class="shop-card-head">
                <div>
                  <p class="eyebrow">${escapeHtml(item.id)}</p>
                  <h3>${escapeHtml(item.name)}</h3>
                </div>
                <span class="shop-emoji">${escapeHtml(item.emoji)}</span>
              </div>
              <div class="shop-meta">
                <span class="shop-badge">${item.cost} 分</span>
              </div>
              <p class="shop-desc">${escapeHtml(item.description)}</p>
              <button class="redeem-button" type="button" data-redeem-item="${escapeHtml(item.id)}" ${
                disabled ? "disabled" : ""
              }>${buttonText}</button>
            </article>
          `;
        })
        .join("");
    }
  }

}

function renderRecordsPage(): void {
  renderServerTime(document.getElementById("records-server-time"), getServerTime());
  const scorePill = document.getElementById("records-score-pill");

  if (scorePill) {
    scorePill.textContent = `${state.currentUser} · ${getCurrentUserScore()} 分`;
  }

  renderGamesList(document.getElementById("records-games-list"), getRecentGames());
  renderRedemptionsList(document.getElementById("records-redemptions-list"), getRecentRedemptions());
}

function renderProfilePage(): void {
  renderServerTime(document.getElementById("profile-server-time"), getServerTime() ?? state.profileData?.serverTime ?? null);
  const scorePill = document.getElementById("profile-score-pill");

  if (scorePill) {
    scorePill.textContent = `${state.currentUser} · ${getCurrentUserScore()} 分`;
  }

  renderProfileSummary(document.getElementById("profile-summary"));
  renderGiftCards(document.getElementById("gift-card-grid"), state.profileData?.giftCards ?? []);
  renderGamesList(document.getElementById("profile-games-list"), state.profileData?.recentGames ?? []);
  renderRedemptionsList(document.getElementById("profile-redemptions-list"), state.profileData?.recentRedemptions ?? []);
  renderProfileAdminEntry(document.getElementById("profile-admin-card"));
}

function renderProfileSummary(container: HTMLElement | null): void {
  if (!container) {
    return;
  }

  const user = getCurrentUserProfile();

  if (!user) {
    container.innerHTML = `<div class="empty-card">还没有个人资料。</div>`;
    return;
  }

  container.innerHTML = `
    <article class="profile-panel">
      <div class="profile-panel-head">
        <span class="profile-panel-avatar">${userAvatar(user.id)}</span>
        <div>
          <p class="eyebrow">${escapeHtml(user.id)}</p>
          <h3>${escapeHtml(user.displayName)}</h3>
        </div>
      </div>
      <div class="profile-points">
        <strong>${user.score}</strong>
        <span>当前积分</span>
      </div>
      <div class="profile-meta-row">
        <span class="pill ${user.online ? "online" : "offline"}">${user.online ? "已就位" : "正在赶来"}</span>
        <span class="profile-meta-text">礼物卡 ${state.profileData?.giftCards.length ?? 0} 张</span>
      </div>
    </article>
  `;
}

function renderGiftCards(container: HTMLElement | null, giftCards: GiftCard[]): void {
  if (!container) {
    return;
  }

  if (!giftCards.length) {
    container.innerHTML = `<div class="empty-card">还没有礼物卡片，先去商城兑换一个。</div>`;
    return;
  }

  container.innerHTML = giftCards
    .map(
      (card) => `
        <article class="gift-card">
          <div class="gift-card-glow"></div>
          <div class="gift-card-head">
            <span class="gift-card-emoji">${escapeHtml(card.emoji)}</span>
            <div>
              <p class="eyebrow">${escapeHtml(card.serial)}</p>
              <h3>${escapeHtml(card.itemName)}</h3>
            </div>
          </div>
          <p class="gift-card-desc">${escapeHtml(card.description)}</p>
          <div class="gift-card-meta">
            <span>${card.cost} 分兑换</span>
            <span>${formatDateTime(card.createdAt)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderProfileAdminEntry(container: HTMLElement | null): void {
  if (!container) {
    return;
  }

  container.hidden = !isCurrentUserAdmin();
}

function renderScoreGrid(container: HTMLElement | null, users: UserProfile[]): void {
  if (!container) {
    return;
  }

  if (!users.length) {
    container.innerHTML = `<div class="empty-card">还没有用户。</div>`;
    return;
  }

  const round = getCurrentRound();
  const onlineStatus = getOnlineStatus();
  const leftUser = users.find((user) => user.id === PRIMARY_USER_ID) ?? users[0];
  const rightUser = users.find((user) => user.id === SECONDARY_USER_ID) ?? users[1] ?? users[0];
  const readyUsers = getReadyUsers(round, onlineStatus);
  const bondState = getBondState(round, onlineStatus);

  container.innerHTML = `
    <div class="bond-board bond-state-${bondState}">
      ${renderBondPlayer(leftUser, "left", round, onlineStatus, readyUsers)}
      <div class="bond-stage">
        <div class="bond-progress" aria-hidden="true">
          <span class="bond-progress-line left"></span>
          <span class="bond-progress-line right"></span>
        </div>
        <div class="bond-orb">
          <span class="bond-orb-label">${buildBondOrbLabel(bondState)}</span>
          <span class="bond-spark spark-a"></span>
          <span class="bond-spark spark-b"></span>
          <span class="bond-spark spark-c"></span>
          <span class="bond-spark spark-d"></span>
        </div>
        <p class="bond-center-note">${buildBondCenterNote(bondState, round, readyUsers.length)}</p>
      </div>
      ${renderBondPlayer(rightUser, "right", round, onlineStatus, readyUsers)}
    </div>
  `;
}

function renderBondPlayer(
  user: UserProfile,
  side: "left" | "right",
  round: RoundSnapshot,
  onlineStatus: OnlineStatus,
  readyUsers: UserId[],
): string {
  const isReady = readyUsers.includes(user.id);
  const isCollecting = round.status === "collecting";
  const isCurrentUser = user.id === state.currentUser;
  const otherUserId = user.id === PRIMARY_USER_ID ? SECONDARY_USER_ID : PRIMARY_USER_ID;
  const otherOnline = onlineStatus[otherUserId];
  const shouldShowBubble = user.online;
  const canPoke = !isCurrentUser;
  const actionLabel = user.online ? "比个心" : "戳一戳";

  return `
    <article class="bond-player ${side} ${user.online ? "online" : "offline"} ${isReady ? "ready" : ""} ${
      isCurrentUser ? "current-user" : ""
    } ${state.pokedUserId === user.id ? "poked" : ""}">
      ${
        shouldShowBubble
          ? `<span class="bond-bubble ${isReady ? "ready" : "online"}">${escapeHtml(
              buildBondBubbleLabel(user.id, round, otherOnline),
            )}</span>`
          : ""
      }
      <div class="bond-avatar-wrap">
        <span class="bond-avatar-ring"></span>
        <span class="bond-avatar">${userAvatar(user.id)}</span>
      </div>
      <div class="bond-copy">
        <p class="bond-name">${escapeHtml(user.displayName)}</p>
        <p class="bond-status">${escapeHtml(buildBondStatusLabel(user.id, user.online, isReady, isCollecting, otherOnline))}</p>
      </div>
      <div class="bond-score">
        <strong>${user.score}</strong>
        <span>分</span>
      </div>
      ${canPoke ? `<button class="bond-action" type="button" data-poke-user="${user.id}">${actionLabel}</button>` : ""}
    </article>
  `;
}

function getReadyUsers(round: RoundSnapshot, onlineStatus: OnlineStatus): UserId[] {
  if (round.status === "collecting") {
    return round.choicesSubmitted;
  }

  return FIXED_USER_IDS.filter((userId) => onlineStatus[userId]);
}

function getBondState(round: RoundSnapshot, onlineStatus: OnlineStatus): string {
  const allOnline = FIXED_USER_IDS.every((userId) => onlineStatus[userId]);

  if (allOnline && round.status === "resolved") {
    return "burst";
  }

  if (round.status === "collecting" && round.choicesSubmitted.length === 1) {
    return round.choicesSubmitted[0] === PRIMARY_USER_ID ? "ready-left" : "ready-right";
  }

  if (allOnline) {
    return "linked";
  }

  if (onlineStatus[PRIMARY_USER_ID]) {
    return "ready-left";
  }

  if (onlineStatus[SECONDARY_USER_ID]) {
    return "ready-right";
  }

  return "idle";
}

function buildBondOrbLabel(bondState: string): string {
  if (bondState === "burst") {
    return "Boom";
  }

  if (bondState === "idle") {
    return "Wait";
  }

  return "Ready";
}

function buildBondCenterNote(bondState: string, round: RoundSnapshot, readyCount: number): string {
  if (bondState === "burst") {
    return "合体成功";
  }

  if (round.status === "collecting" && readyCount === 1) {
    return "等另一位出手";
  }

  if (bondState === "linked") {
    return "双人已连线";
  }

  if (bondState === "ready-left" || bondState === "ready-right") {
    return "信号正在靠近";
  }

  return "等待连线";
}

function buildBondBubbleLabel(userId: UserId, round: RoundSnapshot, otherOnline: boolean): string {
  if (round.status === "collecting" && round.choicesSubmitted.includes(userId)) {
    return "Ready!";
  }

  if (otherOnline) {
    return "已就位";
  }

  return "我来了";
}

function buildBondStatusLabel(
  userId: UserId,
  isOnline: boolean,
  isReady: boolean,
  isCollecting: boolean,
  otherOnline: boolean,
): string {
  if (!isOnline) {
    return otherOnline ? "等得花儿都谢了" : "正在赶来";
  }

  if (isCollecting) {
    return isReady ? "已就位" : "还没出手";
  }

  if (otherOnline) {
    return "已就位";
  }

  return userId === state.currentUser ? "先守在这" : "刚刚到场";
}

function triggerPokeVisual(userId: UserId): void {
  state.pokedUserId = userId;

  if (state.pokeTimer !== null) {
    window.clearTimeout(state.pokeTimer);
  }

  renderActiveScoreGrid();

  state.pokeTimer = window.setTimeout(() => {
    state.pokedUserId = null;
    renderActiveScoreGrid();
  }, 1800);
}

function renderActiveScoreGrid(): void {
  const containerId = page === "games" ? "games-score-grid" : "score-grid";
  renderScoreGrid(document.getElementById(containerId), getUsers());
}

function updateDashboardMood(users: UserProfile[]): void {
  if (page !== "dashboard") {
    return;
  }

  const onlineCount = users.filter((user) => user.online).length;
  const round = getCurrentRound();
  const readyCount = round.status === "collecting" ? round.choicesSubmitted.length : onlineCount;

  if (onlineCount === 2 && readyCount >= 2) {
    document.body.dataset.dashboardMood = "synced";
    return;
  }

  if (onlineCount > 0) {
    document.body.dataset.dashboardMood = "seeking";
    return;
  }

  document.body.dataset.dashboardMood = "idle";
}

function renderGameArea(): void {
  const round = getCurrentRound();
  const displayedGameType = getDisplayedGameType();
  const startButton = document.getElementById("start-game-btn") as HTMLButtonElement | null;
  const forceEndButton = document.getElementById("force-end-game-btn") as HTMLButtonElement | null;
  const title = document.getElementById("round-title");
  const summary = document.getElementById("round-summary");
  const hint = document.getElementById("choice-hint");
  const selector = document.getElementById("game-selector");
  const panel = document.getElementById("game-panel");
  const online = getOnlineStatus();
  const allOnline = FIXED_USER_IDS.every((userId) => online[userId]);
  const activeRound = round.status === "collecting" || round.gameType === displayedGameType ? round : null;
  const currentCatalog = getGameCatalog(displayedGameType);

  if (selector) {
    selector.innerHTML = GAME_CATALOG.map((item) => {
      const active = item.type === displayedGameType;
      const locked = round.status === "collecting" && !active;

      return `
        <button class="game-chip ${active ? "active" : ""}" type="button" data-game-select="${item.type}" ${
          locked ? "disabled" : ""
        }>
          <span class="game-chip-emoji">${item.emoji}</span>
          <span class="game-chip-copy">
            <strong>${item.label}</strong>
            <small>${item.subtitle}</small>
          </span>
        </button>
      `;
    }).join("");
  }

  if (title) {
    if (activeRound && activeRound.roundId > 0 && activeRound.status !== "idle") {
      title.textContent = `第 ${activeRound.roundId} 局 · ${gameTypeLabel(activeRound.gameType)}`;
    } else {
      title.textContent = `未开始 · ${currentCatalog.label}`;
    }
  }

  if (summary) {
    if (activeRound && (activeRound.status === "collecting" || activeRound.gameType === displayedGameType)) {
      summary.textContent = activeRound.summary;
    } else {
      summary.textContent = currentCatalog.description;
    }
  }

  if (hint) {
    hint.textContent = buildHintText(displayedGameType, activeRound, allOnline);
  }

  if (panel) {
    panel.innerHTML = renderGamePanel(displayedGameType, activeRound);
  }

  if (startButton) {
    startButton.disabled = !allOnline || round.status === "collecting";
    startButton.textContent = round.status === "collecting" ? `${gameTypeLabel(round.gameType)} 进行中` : `开始${currentCatalog.label}`;
  }

  if (forceEndButton) {
    forceEndButton.disabled = round.status !== "collecting";
  }
}

function renderGamePanel(gameType: GameType, round: RoundSnapshot | null): string {
  switch (gameType) {
    case "rps":
      return renderRpsPanel(round);
    case "telepathy":
      return renderTelepathyPanel(round);
    case "guess-number":
      return renderGuessNumberPanel(round);
    case "charades":
      return renderCharadesPanel(round);
  }
}

function renderRpsPanel(round: RoundSnapshot | null): string {
  const hasSubmitted = Boolean(round?.choicesSubmitted.includes(state.currentUser));
  const enabled = Boolean(round && round.status === "collecting" && !hasSubmitted);

  return `
    <div class="choice-grid">
      ${RPS_OPTIONS.map((option) => {
        const isSelected = round?.status === "resolved" && round.revealedChoices[state.currentUser] === option.label;

        return `
          <button type="button" class="choice-button ${isSelected ? "selected" : ""}" data-rps-choice="${option.id}" ${
            enabled ? "" : "disabled"
          }>
            <span class="choice-emoji">${option.emoji}</span>
            <span>${option.label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderTelepathyPanel(round: RoundSnapshot | null): string {
  const previewPrompt = TELEPATHY_PROMPTS[0];
  const promptText = round?.promptText ?? previewPrompt.text;
  const options = round?.options.length ? round.options : previewPrompt.options;
  const hasSubmitted = Boolean(round?.choicesSubmitted.includes(state.currentUser));
  const enabled = Boolean(round && round.status === "collecting" && !hasSubmitted);

  return `
    <div class="option-stack">
      <div class="option-prompt">${escapeHtml(promptText)}</div>
      <div class="option-grid two-col">
        ${options
          .map((option) => {
            const isSelected = round?.status === "resolved" && round.revealedChoices[state.currentUser] === option.label;

            return `
              <button type="button" class="choice-button text-choice ${isSelected ? "selected" : ""}" data-telepathy-option="${escapeHtml(option.id)}" ${
                enabled ? "" : "disabled"
              }>
                <span>${escapeHtml(option.label)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderGuessNumberPanel(round: RoundSnapshot | null): string {
  const min = round?.min ?? DEFAULT_GUESS_RANGE.min;
  const max = round?.max ?? DEFAULT_GUESS_RANGE.max;
  const hasSubmitted = Boolean(round?.choicesSubmitted.includes(state.currentUser));
  const enabled = Boolean(round && round.status === "collecting" && !hasSubmitted);
  const revealText =
    round?.status === "resolved" && round.target !== null
      ? `目标是 ${round.target}`
      : `会在 ${min}-${max} 里随机出题`;

  return `
    <form class="number-form" data-guess-number-form>
      <div class="number-note">${escapeHtml(revealText)}</div>
      <div class="number-controls">
        <input class="number-input" type="number" min="${min}" max="${max}" step="1" data-guess-number-input value="${
          enabled ? escapeHtml(state.guessNumberDraft) : ""
        }" ${enabled ? "" : "disabled"} placeholder="输入 ${min}-${max} 的整数" />
        <button class="primary-button compact" type="submit" ${enabled ? "" : "disabled"}>提交数字</button>
      </div>
    </form>
  `;
}

function renderCharadesPanel(round: RoundSnapshot | null): string {
  const isCollecting = Boolean(round && round.status === "collecting");
  const isDescriber = round?.describerId === state.currentUser;
  const isGuesser = round?.guesserId === state.currentUser;
  const hasSubmitted = Boolean(round?.choicesSubmitted.includes(state.currentUser));
  const describerReady = Boolean(round?.describerId && round.choicesSubmitted.includes(round.describerId));
  const revealText =
    round?.status === "resolved" && round.secretWord
      ? `答案是 ${round.secretWord}`
      : round?.secretCategory
        ? `${round.secretCategory} · ${round.secretDifficulty ?? "easy"}`
        : "开始后系统会随机出词";

  if (!isCollecting || !round) {
    return `
      <div class="charades-card">
        <div class="charades-word-card">
          <p class="eyebrow">新玩法</p>
          <h3>系统发词，一人描述，一人来猜</h3>
          <p class="charades-meta">${escapeHtml(revealText)}</p>
        </div>
      </div>
    `;
  }

  if (isDescriber) {
    return `
      <div class="charades-card">
        <div class="charades-word-card spotlight">
          <p class="eyebrow">你的词</p>
          <h3>${escapeHtml(round.secretWord ?? "--")}</h3>
          <p class="charades-meta">${escapeHtml(revealText)}</p>
        </div>
        <div class="charades-tip-box">
          <p>用别的词描述，别直接说出答案。</p>
          <button class="primary-button" type="button" data-charades-ready ${hasSubmitted ? "disabled" : ""}>
            ${hasSubmitted ? "已经准备好" : "我看好词了"}
          </button>
        </div>
      </div>
    `;
  }

  if (isGuesser && !describerReady) {
    return `
      <div class="charades-card">
        <div class="charades-word-card">
          <p class="eyebrow">等一下</p>
          <h3>对方正在看词</h3>
          <p class="charades-meta">等他准备好后，你就可以输入答案。</p>
        </div>
      </div>
    `;
  }

  return `
    <form class="charades-card" data-charades-form>
      <div class="charades-word-card">
        <p class="eyebrow">轮到你猜</p>
        <h3>把你想到的词输进来</h3>
        <p class="charades-meta">${escapeHtml(revealText)}</p>
      </div>
      <div class="charades-input-row">
        <input
          class="number-input charades-input"
          type="text"
          data-charades-input
          value="${hasSubmitted ? "" : escapeHtml(state.charadesGuessDraft)}"
          placeholder="输入你猜到的词"
          ${hasSubmitted ? "disabled" : ""}
        />
        <button class="primary-button compact" type="submit" ${hasSubmitted ? "disabled" : ""}>提交答案</button>
      </div>
    </form>
  `;
}

function buildHintText(gameType: GameType, round: RoundSnapshot | null, allOnline: boolean): string {
  if (!allOnline) {
    return "两个人都在线才能开始。";
  }

  if (!round || round.status === "idle") {
    return getGameCatalog(gameType).description;
  }

  const hasSubmitted = round.choicesSubmitted.includes(state.currentUser);

  if (round.status === "collecting") {
    if (hasSubmitted) {
      return "已提交，等对方。";
    }

    if (gameType === "rps") {
      return "轮到你出拳。";
    }

    if (gameType === "telepathy") {
      return "选一个答案。";
    }

    if (gameType === "charades") {
      if (round.describerId === state.currentUser) {
        return round.choicesSubmitted.includes(state.currentUser) ? "开始描述吧，等对方来猜。" : "先看词，再点准备好。";
      }

      if (!round.describerId || !round.choicesSubmitted.includes(round.describerId)) {
        return "对方还在看词。";
      }

      return "听描述，猜一个词。";
    }

    return `输入 ${round.min ?? DEFAULT_GUESS_RANGE.min}-${round.max ?? DEFAULT_GUESS_RANGE.max} 的整数。`;
  }

  if (round.status === "resolved" && round.gameType === gameType) {
    const revealed = Object.entries(round.revealedChoices)
      .map(([userId, value]) => `${userId} 选了 ${value}`)
      .join("，");

    return revealed ? `本局：${revealed}。` : round.summary;
  }

  return getGameCatalog(gameType).description;
}

function renderGamesList(container: HTMLElement | null, records: GameRecord[]): void {
  if (!container) {
    return;
  }

  if (!records.length) {
    container.innerHTML = `<li class="empty-card">还没有游戏记录。</li>`;
    return;
  }

  container.innerHTML = records
    .map((record) => {
      return `
        <li class="timeline-item">
          <div class="timeline-main">
            <span class="timeline-title">${escapeHtml(gameTypeLabel(record.gameType))}</span>
            <span class="timeline-meta">${formatDateTime(record.playedAt)}</span>
          </div>
          <div class="timeline-desc">${escapeHtml(buildRecordSummary(record))}</div>
        </li>
      `;
    })
    .join("");
}

function renderRedemptionsList(container: HTMLElement | null, records: RedemptionRecord[]): void {
  if (!container) {
    return;
  }

  if (!records.length) {
    container.innerHTML = `<li class="empty-card">还没有兑换记录。</li>`;
    return;
  }

  container.innerHTML = records
    .map(
      (record) => `
        <li class="timeline-item">
          <div class="timeline-main">
            <span class="timeline-title">${escapeHtml(record.itemName)}</span>
            <span class="timeline-meta">${formatDateTime(record.createdAt)}</span>
          </div>
          <div class="timeline-meta">${escapeHtml(record.userId)} 兑换，扣除 ${record.cost} 分</div>
        </li>
      `,
    )
    .join("");
}

function getUsers(): UserProfile[] {
  if (state.adminData) {
    return state.adminData.users;
  }

  if (state.dashboard) {
    return state.dashboard.users;
  }

  if (state.shopData) {
    return state.shopData.users;
  }

  if (state.recordsData) {
    return state.recordsData.users;
  }

  if (state.profileData) {
    return [state.profileData.user];
  }

  return [];
}

function getCurrentUserProfile(): UserProfile | null {
  return getUsers().find((user) => user.id === state.currentUser) ?? state.profileData?.user ?? null;
}

function getCurrentUserScore(): number {
  return getUsers().find((user) => user.id === state.currentUser)?.score ?? 0;
}

function getRecentGames(): GameRecord[] {
  if (state.dashboard) {
    return state.dashboard.recentGames;
  }

  if (state.profileData) {
    return state.profileData.recentGames;
  }

  return state.recordsData?.recentGames ?? [];
}

function getRecentRedemptions(): RedemptionRecord[] {
  if (state.dashboard) {
    return state.dashboard.recentRedemptions;
  }

  if (state.shopData) {
    return state.shopData.recentRedemptions;
  }

  if (state.profileData) {
    return state.profileData.recentRedemptions;
  }

  return state.recordsData?.recentRedemptions ?? [];
}

function getShopItems(): ShopItem[] {
  if (state.adminData) {
    return state.adminData.shopItems;
  }

  if (state.dashboard) {
    return state.dashboard.shopItems;
  }

  return state.shopData?.shopItems ?? [];
}

function getCurrentRound(): RoundSnapshot {
  return (
    state.dashboard?.currentRound ?? {
      choicesSubmitted: [],
      completedAt: null,
      describerId: null,
      gameType: state.selectedGameType,
      guesserId: null,
      max: null,
      min: null,
      options: [],
      promptText: null,
      revealedChoices: {},
      roundId: 0,
      secretCategory: null,
      secretDifficulty: null,
      secretWord: null,
      startedAt: null,
      status: "idle",
      summary: "先选一个游戏。",
      target: null,
      winnerId: null,
    }
  );
}

function getOnlineStatus(): OnlineStatus {
  if (state.dashboard) {
    return state.dashboard.online;
  }

  const online = Object.fromEntries(FIXED_USER_IDS.map((userId) => [userId, false])) as OnlineStatus;

  for (const user of getUsers()) {
    online[user.id] = user.online;
  }

  return online;
}

function getServerTime(): string | null {
  if (state.dashboard) {
    return state.dashboard.serverTime;
  }

  if (state.shopData) {
    return state.shopData.serverTime;
  }

  if (state.recordsData) {
    return state.recordsData.serverTime;
  }

  if (state.profileData) {
    return state.profileData.serverTime;
  }

  if (state.adminData) {
    return state.adminData.serverTime;
  }

  return null;
}

function renderServerTime(container: HTMLElement | null, serverTime: string | null): void {
  if (!container) {
    return;
  }

  container.textContent = serverTime ? `更新于 ${formatDateTime(serverTime)}` : "--";
}

function syncNavLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-page-link]").forEach((link) => {
    const url = new URL(link.getAttribute("href") ?? "/", window.location.origin);
    url.searchParams.set("user", state.currentUser);
    link.href = `${url.pathname}${url.search}`;
  });

  document.querySelectorAll<HTMLAnchorElement>("[data-profile-admin-link]").forEach((link) => {
    const url = new URL(link.getAttribute("href") ?? "/", window.location.origin);
    url.searchParams.set("user", state.currentUser);
    link.href = `${url.pathname}${url.search}`;
  });
}

function renderNavLinks(): void {
  const currentPath = window.location.pathname;
  const showAdminLink = isCurrentUserAdmin();
  document.body.dataset.isAdmin = showAdminLink ? "true" : "false";

  document.querySelectorAll<HTMLAnchorElement>("[data-page-link]").forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname;
    link.classList.toggle("active", linkPath === currentPath);
    if (link.hasAttribute("data-admin-only")) {
      link.hidden = !showAdminLink;
    }
  });
}

function updateCurrentUserDisplay(): void {
  document.querySelectorAll<HTMLElement>("[data-current-user-display]").forEach((element) => {
    element.textContent = "";
    element.setAttribute("aria-label", userLabel(state.currentUser));
    element.setAttribute("title", userLabel(state.currentUser));
    element.dataset.user = state.currentUser;
  });
}

function isCurrentUserAdmin(): boolean {
  return isAdminUserId(state.currentUser);
}

function setSocketStatus(text: string, kind: "connecting" | "online"): void {
  const pill = document.getElementById("socket-pill");

  if (!pill) {
    return;
  }

  pill.textContent = text;
  pill.classList.remove("connecting", "online");
  pill.classList.add(kind);
}

function showToast(message: string, kind: "success" | "warning" | undefined = undefined): void {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.hidden = false;
  toast.textContent = message;
  toast.className = `toast${kind ? ` ${kind}` : ""}`;

  if (state.toastTimer !== null) {
    window.clearTimeout(state.toastTimer);
  }

  state.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as ApiResponse<T>;

  if (!data.ok) {
    throw new Error(data.error.message);
  }

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return data.data;
}

function getUserFromUrl(): UserId | null {
  return normalizeUserId(new URL(window.location.href).searchParams.get("user"));
}

function loadStoredUser(): UserId {
  return normalizeUserId(localStorage.getItem(USER_STORAGE_KEY)) ?? PRIMARY_USER_ID;
}

function loadSelectedGameType(): GameType {
  const fromStorage = localStorage.getItem(GAME_STORAGE_KEY);

  if (fromStorage === "telepathy" || fromStorage === "guess-number" || fromStorage === "charades") {
    return fromStorage;
  }

  return "rps";
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Ignore storage errors and fall back to system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors and keep current session theme only.
  }
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}

function updateThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((button) => {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    const label = nextTheme === "dark" ? "切换到暗夜模式" : "切换到亮色模式";
    button.textContent = nextTheme === "dark" ? "☾" : "☀";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  });
}

function redirectToChoosePage(): void {
  const next = `${window.location.pathname}${window.location.search}`;
  const url = new URL("/choose.html", window.location.origin);
  url.searchParams.set("next", next);
  window.location.replace(`${url.pathname}${url.search}`);
}

function redirectToHomePage(userId: UserId): void {
  const url = new URL("/games.html", window.location.origin);
  url.searchParams.set("user", userId);
  window.location.replace(`${url.pathname}${url.search}`);
}

function redirectToGamesPage(userId: UserId): void {
  const url = new URL("/games.html", window.location.origin);
  url.searchParams.set("user", userId);
  window.location.replace(`${url.pathname}${url.search}`);
}

function enterWithUser(userId: UserId): void {
  state.currentUser = userId;
  localStorage.setItem(USER_STORAGE_KEY, userId);
  const next = new URL(window.location.href).searchParams.get("next") || "/games.html";
  const nextUrl = new URL(next, window.location.origin);

  if (
    nextUrl.pathname === "/" ||
    nextUrl.pathname === "/choose.html" ||
    nextUrl.pathname === "/index.html" ||
    (nextUrl.pathname === "/admin.html" && !isAdminUserId(userId))
  ) {
    nextUrl.pathname = "/games.html";
  }

  nextUrl.searchParams.set("user", userId);
  window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "发生了一点异常，请稍后再试。";
}

function getDisplayedGameType(): GameType {
  const round = getCurrentRound();
  return round.status === "collecting" ? round.gameType : state.selectedGameType;
}

function syncGameSelectionFromSnapshot(round: RoundSnapshot): void {
  if (round.roundId > 0 && round.status !== "idle") {
    state.selectedGameType = round.gameType;
    localStorage.setItem(GAME_STORAGE_KEY, round.gameType);
  }
}

function getGameCatalog(gameType: GameType) {
  return GAME_CATALOG.find((item) => item.type === gameType) ?? GAME_CATALOG[0];
}

function buildRecordSummary(record: GameRecord): string {
  const gameLabel = gameTypeLabel(record.gameType);

  if (record.winnerId) {
    return `${userLabel(record.winnerId)} 在${gameLabel}中赢了 ${record.scoreDelta[record.winnerId]} 分。`;
  }

  if (record.gameType === "charades" && record.scoreDelta[PRIMARY_USER_ID] === 0 && record.scoreDelta[SECONDARY_USER_ID] === 0) {
    return record.summary;
  }

  if (record.scoreDelta[PRIMARY_USER_ID] === record.scoreDelta[SECONDARY_USER_ID]) {
    return `双方在${gameLabel}中各得 ${record.scoreDelta[PRIMARY_USER_ID]} 分。`;
  }

  return `双方在${gameLabel}中完成了本局结算。`;
}
