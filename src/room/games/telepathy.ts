import {
  PRIMARY_USER_ID,
  SECONDARY_USER_ID,
  TELEPATHY_MATCH_POINTS,
  TELEPATHY_PARTICIPATION_POINTS,
} from "../../shared/constants";
import { createEmptyScoreBoard } from "../../shared/utils";
import type { GameResolution, TelepathyOption, UserId } from "../../shared/types";

function optionLabel(options: TelepathyOption[], optionId: string): string {
  return options.find((option) => option.id === optionId)?.label ?? optionId;
}

export function resolveTelepathyRound(input: {
  choices: Record<UserId, string>;
  options: TelepathyOption[];
  promptText: string;
}): GameResolution {
  const recordedChoices = {
    [PRIMARY_USER_ID]: optionLabel(input.options, input.choices[PRIMARY_USER_ID]),
    [SECONDARY_USER_ID]: optionLabel(input.options, input.choices[SECONDARY_USER_ID]),
  };

  if (input.choices[PRIMARY_USER_ID] === input.choices[SECONDARY_USER_ID]) {
    return {
      detailLines: [
        `题目：${input.promptText}`,
        `两个人都选了「${recordedChoices[PRIMARY_USER_ID]}」。`,
      ],
      recordedChoices,
      scoreDelta: {
        [PRIMARY_USER_ID]: TELEPATHY_MATCH_POINTS,
        [SECONDARY_USER_ID]: TELEPATHY_MATCH_POINTS,
      },
      summary: `双方在默契问答中各得 ${TELEPATHY_MATCH_POINTS} 分。`,
      winnerId: null,
    };
  }

  const scoreDelta = createEmptyScoreBoard();
  scoreDelta[PRIMARY_USER_ID] = TELEPATHY_PARTICIPATION_POINTS;
  scoreDelta[SECONDARY_USER_ID] = TELEPATHY_PARTICIPATION_POINTS;

  return {
    detailLines: [
      `题目：${input.promptText}`,
      `${PRIMARY_USER_ID} 选了「${recordedChoices[PRIMARY_USER_ID]}」，${SECONDARY_USER_ID} 选了「${recordedChoices[SECONDARY_USER_ID]}」。`,
    ],
    recordedChoices,
    scoreDelta,
    summary: `双方在默契问答中各得 ${TELEPATHY_PARTICIPATION_POINTS} 分。`,
    winnerId: null,
  };
}
