/** Translation of a play group and its cards into the centered trick stack. */
export function tableCollectionOffsets(
  stageWidth: number,
  stageHeight: number,
  cardWidth: number,
  cardHeight: number,
  groupLeft: number,
  groupTop: number,
  cardLeft: number,
) {
  return {
    groupX: (stageWidth - cardWidth) / 2 - groupLeft,
    groupY: (stageHeight - cardHeight) / 2 - groupTop,
    cardX: -cardLeft,
  };
}
