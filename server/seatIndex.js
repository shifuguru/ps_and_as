/** Remap a seat index after splicing `removedIdx` out of the players array. */
function adjustSeatIndexAfterRemoval(index, removedIdx) {
  if (typeof index !== 'number' || index < 0) return index;
  if (index === removedIdx) return null;
  if (index > removedIdx) return index - 1;
  return index;
}

module.exports = {
  adjustSeatIndexAfterRemoval,
};
