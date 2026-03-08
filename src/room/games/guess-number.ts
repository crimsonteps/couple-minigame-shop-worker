import {
  GUESS_NUMBER_DRAW_POINTS,
  GUESS_NUMBER_WIN_POINTS,
  PRIMARY_USER_ID,
  SECONDARY_USER_ID,
} from "../../shared/constants";
import { createEmptyScoreBoard } from "../../shared/utils";
import type { GameResolution, UserId } from "../../shared/types";

export function resolveGuessNumberRound(input: {
  guesses: Record<UserId, number>;
  max: number;
  min: number;
  target: number;
}): GameResolution {
  const diffU1 = Math.abs(input.guesses[PRIMARY_USER_ID] - input.target);
  const diffU2 = Math.abs(input.guesses[SECONDARY_USER_ID] - input.target);
  const recordedChoices = {
    [PRIMARY_USER_ID]: String(input.guesses[PRIMARY_USER_ID]),
    [SECONDARY_USER_ID]: String(input.guesses[SECONDARY_USER_ID]),
  };

  if (diffU1 === diffU2) {
    return {
      detailLines: [
        `目标数字是 ${input.target}。`,
        `${PRIMARY_USER_ID} 猜了 ${input.guesses[PRIMARY_USER_ID]}（差 ${diffU1}），${SECONDARY_USER_ID} 猜了 ${input.guesses[SECONDARY_USER_ID]}（差 ${diffU2}）。`,
      ],
      recordedChoices,
      scoreDelta: {
        [PRIMARY_USER_ID]: GUESS_NUMBER_DRAW_POINTS,
        [SECONDARY_USER_ID]: GUESS_NUMBER_DRAW_POINTS,
      },
      summary: `双方在猜数字中各得 ${GUESS_NUMBER_DRAW_POINTS} 分。`,
      winnerId: null,
    };
  }

  const winnerId: UserId = diffU1 < diffU2 ? PRIMARY_USER_ID : SECONDARY_USER_ID;
  const scoreDelta = createEmptyScoreBoard();
  scoreDelta[winnerId] = GUESS_NUMBER_WIN_POINTS;

  return {
    detailLines: [
      `目标数字是 ${input.target}。`,
      `${PRIMARY_USER_ID} 猜了 ${input.guesses[PRIMARY_USER_ID]}（差 ${diffU1}），${SECONDARY_USER_ID} 猜了 ${input.guesses[SECONDARY_USER_ID]}（差 ${diffU2}）。`,
    ],
    recordedChoices,
    scoreDelta,
    summary: `${winnerId} 在猜数字中赢了 ${GUESS_NUMBER_WIN_POINTS} 分。`,
    winnerId,
  };
}
