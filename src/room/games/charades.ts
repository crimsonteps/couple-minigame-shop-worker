import { CHARADES_SUCCESS_POINTS, PRIMARY_USER_ID, SECONDARY_USER_ID } from "../../shared/constants";
import { createEmptyScoreBoard, normalizeGuessText } from "../../shared/utils";
import type { GameResolution, UserId } from "../../shared/types";

export function resolveCharadesRound(input: {
  describerId: UserId;
  guess: string;
  guesserId: UserId;
  secretWord: string;
}): GameResolution {
  const scoreDelta = createEmptyScoreBoard();
  const normalizedGuess = normalizeGuessText(input.guess);
  const normalizedAnswer = normalizeGuessText(input.secretWord);
  const success = normalizedGuess === normalizedAnswer;
  const recordedChoices = {
    [PRIMARY_USER_ID]: input.describerId === PRIMARY_USER_ID ? "描述完成" : input.guess,
    [SECONDARY_USER_ID]: input.describerId === SECONDARY_USER_ID ? "描述完成" : input.guess,
  };

  if (success) {
    scoreDelta[PRIMARY_USER_ID] = CHARADES_SUCCESS_POINTS;
    scoreDelta[SECONDARY_USER_ID] = CHARADES_SUCCESS_POINTS;
  }

  return {
    detailLines: success
      ? [`${input.describerId} 描述成功，${input.guesserId} 猜中了「${input.secretWord}」。`]
      : [`${input.guesserId} 猜了「${input.guess}」，正确答案是「${input.secretWord}」。`],
    recordedChoices,
    scoreDelta,
    summary: success
      ? `双方在你比我猜中各得 ${CHARADES_SUCCESS_POINTS} 分。`
      : `这轮你比我猜没有猜中，答案是 ${input.secretWord}。`,
    winnerId: null,
  };
}
