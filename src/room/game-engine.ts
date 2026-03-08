import {
  DEFAULT_GUESS_RANGE,
  FIXED_ROOM_ID,
  PRIMARY_USER_ID,
  SECONDARY_USER_ID,
  TELEPATHY_PROMPTS,
} from "../shared/constants";
import { ConflictError, ValidationError } from "../shared/errors";
import { assertRpsChoice, nowIso, pickRandom } from "../shared/utils";
import type {
  GameRecord,
  GameResolution,
  GameType,
  PersistedRoundState,
  RoundChoiceValue,
  ScoreBoard,
  UserId,
} from "../shared/types";
import { resolveGuessNumberRound } from "./games/guess-number";
import { resolveRpsRound } from "./games/rps";
import { resolveTelepathyRound } from "./games/telepathy";
import { RoomState } from "./room-state";
import { RecordService } from "./services/record-service";
import { ScoreService } from "./services/score-service";
import type { RoomStorage } from "./storage/types";

export interface SubmitChoiceResult {
  gameRecord?: GameRecord;
  resolved: boolean;
  round: PersistedRoundState;
  scores?: ScoreBoard;
}

export class GameEngine {
  constructor(
    private readonly storage: RoomStorage,
    private readonly roomState: RoomState,
    private readonly scoreService: ScoreService,
    private readonly recordService: RecordService,
  ) {}

  startRound(gameType: GameType): PersistedRoundState {
    const currentRound = this.roomState.getCurrentRound();
    this.roomState.assertCanStart(currentRound);

    const baseRound: PersistedRoundState = {
      choices: {},
      completedAt: null,
      gameType,
      max: null,
      min: null,
      options: [],
      promptText: null,
      roundId: currentRound.roundId + 1,
      startedAt: nowIso(),
      status: "collecting",
      summary: "新一轮小游戏开始了，等你们一起提交答案。",
      target: null,
      winnerId: null,
    };

    switch (gameType) {
      case "rps":
        baseRound.summary = "新一轮猜拳开始啦，双方快点出拳。";
        break;
      case "telepathy": {
        const prompt = pickRandom(TELEPATHY_PROMPTS);
        baseRound.promptText = prompt.text;
        baseRound.options = prompt.options.map((option) => ({ ...option }));
        baseRound.summary = "本轮是默契问答，看看你们会不会选到同一个答案。";
        break;
      }
      case "guess-number":
        baseRound.min = DEFAULT_GUESS_RANGE.min;
        baseRound.max = DEFAULT_GUESS_RANGE.max;
        baseRound.target = this.randomGuessTarget();
        baseRound.summary = `系统已经藏好了一个 ${DEFAULT_GUESS_RANGE.min}-${DEFAULT_GUESS_RANGE.max} 的数字，谁更接近谁得分。`;
        break;
    }

    return this.roomState.saveRound(baseRound);
  }

  submitChoice(userId: UserId, rawChoice: RoundChoiceValue): SubmitChoiceResult {
    const currentRound = this.roomState.getCurrentRound();
    const normalizedChoice = this.normalizeChoice(currentRound, rawChoice);
    const updatedRound = this.roomState.applyChoice(currentRound, userId, normalizedChoice);

    if (!this.roomState.hasAllChoices(updatedRound)) {
      return {
        resolved: false,
        round: this.roomState.saveRound(updatedRound),
      };
    }

    const playedAt = nowIso();
    const resolution = this.resolveRound(updatedRound);
    let gameRecord: GameRecord | undefined;
    let scores: ScoreBoard | undefined;
    let resolvedRound: PersistedRoundState = updatedRound;

    this.storage.transactionSync(() => {
      scores = this.scoreService.applyScoreDelta(resolution.scoreDelta);
      gameRecord = this.recordService.insertGameRecord({
        choices: resolution.recordedChoices,
        detailLines: resolution.detailLines,
        gameType: updatedRound.gameType,
        playedAt,
        roomId: FIXED_ROOM_ID,
        scoreDelta: resolution.scoreDelta,
        summary: resolution.summary,
        winnerId: resolution.winnerId,
      });
      resolvedRound = this.roomState.markResolved(
        updatedRound,
        resolution.winnerId,
        resolution.summary,
        playedAt,
      );
    });

    return {
      gameRecord,
      resolved: true,
      round: resolvedRound,
      scores,
    };
  }

  private normalizeChoice(round: PersistedRoundState, rawChoice: RoundChoiceValue): RoundChoiceValue {
    if (round.gameType === "rps") {
      return assertRpsChoice(rawChoice);
    }

    if (round.gameType === "telepathy") {
      const optionId = String(rawChoice ?? "").trim();

      if (!optionId || !round.options.some((option) => option.id === optionId)) {
        throw new ValidationError("INVALID_OPTION", "这道默契问答没有这个选项。");
      }

      return optionId;
    }

    const guess = typeof rawChoice === "number" ? rawChoice : Number(rawChoice);

    if (!Number.isInteger(guess)) {
      throw new ValidationError("INVALID_GUESS", "猜数字必须提交整数。");
    }

    if (round.min === null || round.max === null) {
      throw new ConflictError("INVALID_ROUND", "当前猜数字回合没有正确初始化。");
    }

    if (guess < round.min || guess > round.max) {
      throw new ValidationError("GUESS_OUT_OF_RANGE", `猜数字必须在 ${round.min}-${round.max} 之间。`);
    }

    return guess;
  }

  private resolveRound(round: PersistedRoundState): GameResolution {
    if (round.choices[PRIMARY_USER_ID] === undefined || round.choices[SECONDARY_USER_ID] === undefined) {
      throw new ConflictError("ROUND_NOT_COMPLETE", "双方都提交后才能结算。");
    }

    switch (round.gameType) {
      case "rps":
        return resolveRpsRound({
          [PRIMARY_USER_ID]: assertRpsChoice(round.choices[PRIMARY_USER_ID]),
          [SECONDARY_USER_ID]: assertRpsChoice(round.choices[SECONDARY_USER_ID]),
        });
      case "telepathy":
        return resolveTelepathyRound({
          choices: {
            [PRIMARY_USER_ID]: String(round.choices[PRIMARY_USER_ID]),
            [SECONDARY_USER_ID]: String(round.choices[SECONDARY_USER_ID]),
          },
          options: round.options,
          promptText: round.promptText ?? "本轮默契问答",
        });
      case "guess-number":
        if (round.target === null || round.min === null || round.max === null) {
          throw new ConflictError("INVALID_ROUND", "当前猜数字回合没有正确初始化。");
        }

        return resolveGuessNumberRound({
          guesses: {
            [PRIMARY_USER_ID]: Number(round.choices[PRIMARY_USER_ID]),
            [SECONDARY_USER_ID]: Number(round.choices[SECONDARY_USER_ID]),
          },
          max: round.max,
          min: round.min,
          target: round.target,
        });
    }
  }

  private randomGuessTarget(): number {
    return Math.floor(Math.random() * (DEFAULT_GUESS_RANGE.max - DEFAULT_GUESS_RANGE.min + 1)) + DEFAULT_GUESS_RANGE.min;
  }
}
