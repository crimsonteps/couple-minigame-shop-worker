import { DRAW_POINTS, PRIMARY_USER_ID, SECONDARY_USER_ID, WIN_POINTS } from "../../shared/constants";
import { choiceLabel, createEmptyScoreBoard, userLabel } from "../../shared/utils";
import type { GameResolution, RpsChoice, UserId } from "../../shared/types";

const WIN_RULES: Record<RpsChoice, RpsChoice> = {
  paper: "rock",
  rock: "scissors",
  scissors: "paper",
};

export function resolveRpsRound(choices: Record<UserId, RpsChoice>): GameResolution {
  const recordedChoices = {
    [PRIMARY_USER_ID]: choiceLabel(choices[PRIMARY_USER_ID]),
    [SECONDARY_USER_ID]: choiceLabel(choices[SECONDARY_USER_ID]),
  };

  if (choices[PRIMARY_USER_ID] === choices[SECONDARY_USER_ID]) {
    return {
      detailLines: [`双方同时出了 ${recordedChoices[PRIMARY_USER_ID]}。`],
      recordedChoices,
      scoreDelta: {
        [PRIMARY_USER_ID]: DRAW_POINTS,
        [SECONDARY_USER_ID]: DRAW_POINTS,
      },
      summary: `双方在猜拳中各得 ${DRAW_POINTS} 分。`,
      winnerId: null,
    };
  }

  const winnerId: UserId =
    WIN_RULES[choices[PRIMARY_USER_ID]] === choices[SECONDARY_USER_ID] ? PRIMARY_USER_ID : SECONDARY_USER_ID;
  const scoreDelta = createEmptyScoreBoard();
  scoreDelta[winnerId] = WIN_POINTS;

  return {
    detailLines: [
      `${PRIMARY_USER_ID} 出 ${recordedChoices[PRIMARY_USER_ID]}，${SECONDARY_USER_ID} 出 ${recordedChoices[SECONDARY_USER_ID]}。`,
    ],
    recordedChoices,
    scoreDelta,
    summary: `${userLabel(winnerId)} 在猜拳中赢了 ${WIN_POINTS} 分。`,
    winnerId,
  };
}
