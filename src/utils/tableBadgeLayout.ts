export function playTypeBadgeBelowCardsTop(
  positions: ReadonlyArray<{ top: number }>,
  cardHeight: number,
  gap: number,
): number {
  const lowestCardBottom = Math.max(
    ...positions.map((position) => position.top + cardHeight),
  );
  return lowestCardBottom + gap;
}
