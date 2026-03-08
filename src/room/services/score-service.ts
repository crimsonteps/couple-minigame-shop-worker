import { FIXED_USER_IDS } from "../../shared/constants";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { createEmptyScoreBoard, nowIso } from "../../shared/utils";
import type { ScoreBoard, UserId } from "../../shared/types";
import type { RoomStorage } from "../storage/types";

export class ScoreService {
  constructor(private readonly storage: RoomStorage) {}

  getScores(): ScoreBoard {
    const rows = this.storage.sql.exec<{ id: string; score: number }>("SELECT id, score FROM users").toArray();
    const scores = createEmptyScoreBoard();

    for (const row of rows) {
      if (FIXED_USER_IDS.includes(row.id as UserId)) {
        scores[row.id as UserId] = Number(row.score ?? 0);
      }
    }

    return scores;
  }

  getScore(userId: UserId): number {
    const rows = this.storage.sql.exec<{ score: number }>(
      "SELECT score FROM users WHERE id = ? LIMIT 1",
      userId,
    ).toArray();

    if (!rows[0]) {
      throw new NotFoundError("USER_NOT_FOUND", "用户不存在。");
    }

    return Number(rows[0].score ?? 0);
  }

  applyScoreDelta(scoreDelta: ScoreBoard): ScoreBoard {
    const timestamp = nowIso();

    for (const userId of FIXED_USER_IDS) {
      const delta = scoreDelta[userId];

      if (delta === 0) {
        continue;
      }

      this.storage.sql.exec(
        "UPDATE users SET score = score + ?, updated_at = ? WHERE id = ?",
        delta,
        timestamp,
        userId,
      );
    }

    return this.getScores();
  }

  setScore(userId: UserId, nextScore: number): number {
    if (!Number.isInteger(nextScore) || nextScore < 0) {
      throw new ValidationError("INVALID_SCORE", "积分必须是大于等于 0 的整数。");
    }

    const updatedAt = nowIso();

    this.storage.sql.exec(
      "UPDATE users SET score = ?, updated_at = ? WHERE id = ?",
      nextScore,
      updatedAt,
      userId,
    );

    return this.getScore(userId);
  }

  deductScore(userId: UserId, amount: number): number {
    const currentScore = this.getScore(userId);

    if (currentScore < amount) {
      throw new ConflictError("INSUFFICIENT_SCORE", "积分不够，暂时还不能兑换这个礼物。");
    }

    this.storage.sql.exec(
      "UPDATE users SET score = score - ?, updated_at = ? WHERE id = ?",
      amount,
      nowIso(),
      userId,
    );

    return this.getScore(userId);
  }
}
