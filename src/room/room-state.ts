import { FIXED_USER_IDS, INITIAL_ROUND_STATE } from "../shared/constants";
import { ConflictError } from "../shared/errors";
import { cloneRoundState, nowIso } from "../shared/utils";
import type { PersistedRoundState, RoundChoiceValue, UserId } from "../shared/types";
import type { RoomStorage } from "./storage/types";

export class RoomState {
  constructor(private readonly storage: RoomStorage) {}

  getCurrentRound(): PersistedRoundState {
    const rows = this.storage.sql.exec<{ value: string }>(
      "SELECT value FROM room_state WHERE key = ? LIMIT 1",
      "current_round",
    ).toArray();

    if (!rows[0]?.value) {
      return cloneRoundState(INITIAL_ROUND_STATE);
    }

    const parsed = JSON.parse(String(rows[0].value)) as PersistedRoundState;
    return cloneRoundState(parsed);
  }

  assertCanStart(round: PersistedRoundState): void {
    if (round.status === "collecting") {
      throw new ConflictError("ROUND_IN_PROGRESS", "当前回合还没结束，不能开始新的一局。");
    }
  }

  applyChoice(round: PersistedRoundState, userId: UserId, choice: RoundChoiceValue): PersistedRoundState {
    if (round.status !== "collecting") {
      throw new ConflictError("ROUND_NOT_READY", "当前没有可提交的小游戏回合。");
    }

    if (round.choices[userId] !== undefined) {
      throw new ConflictError("CHOICE_ALREADY_SUBMITTED", "这一局你已经提交过答案了。");
    }

    const nextRound = cloneRoundState(round);
    nextRound.choices[userId] = choice;
    const totalChoices = Object.keys(nextRound.choices).length;
    nextRound.summary =
      totalChoices === 1 ? "已经收到 1/2 份答案，等另一位提交。" : "双方都已提交，马上揭晓结果。";

    return nextRound;
  }

  hasAllChoices(round: PersistedRoundState): boolean {
    return FIXED_USER_IDS.every((userId) => round.choices[userId] !== undefined);
  }

  markResolved(
    round: PersistedRoundState,
    winnerId: UserId | null,
    summary: string,
    completedAt: string,
  ): PersistedRoundState {
    const resolvedRound = cloneRoundState(round);
    resolvedRound.status = "resolved";
    resolvedRound.winnerId = winnerId;
    resolvedRound.completedAt = completedAt;
    resolvedRound.summary = summary;
    return this.saveRound(resolvedRound);
  }

  saveRound(round: PersistedRoundState): PersistedRoundState {
    this.storage.sql.exec(
      `
        INSERT INTO room_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      "current_round",
      JSON.stringify(round),
      nowIso(),
    );

    return cloneRoundState(round);
  }
}
