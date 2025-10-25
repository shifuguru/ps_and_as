// Additional runtime tests using compiled core (dist-scripts/src/game/core.js)
const core = require('../src/game/core');

function card(v, suit = 'spades') { return { value: v, suit }; }

console.log('Running additional core tests...');

(function test_isValidPlay_basic() {
  // pile is two 7s
  const pile = [ card(7), card(7) ];
  // playing two 8s should be valid
  const playGood = [ card(8), card(8) ];
  // playing one 9 should be invalid (count mismatch)
  const playBad = [ card(9) ];

  const ok = core.isValidPlay(playGood, pile);
  const bad = core.isValidPlay(playBad, pile);

  if (ok && !bad) console.log('PASS: isValidPlay basic higher same-count');
  else { console.error('FAIL: isValidPlay basic', { ok, bad }); process.exitCode = 2; }
})();

(function test_four_of_a_kind_detection() {
  const four = [ card(5), card(5), card(5), card(5) ];
  const notFour = [ card(5), card(5), card(5), card(6) ];
  if (core.isFourOfAKind(four) && !core.isFourOfAKind(notFour)) console.log('PASS: isFourOfAKind');
  else { console.error('FAIL: isFourOfAKind'); process.exitCode = 3; }
})();

(function test_contains_two() {
  const t1 = [ card(2) ];
  const t2 = [ card(3), card(4) ];
  if (core.containsTwo(t1) && !core.containsTwo(t2)) console.log('PASS: containsTwo');
  else { console.error('FAIL: containsTwo'); process.exitCode = 4; }
})();

console.log('additional tests completed');
