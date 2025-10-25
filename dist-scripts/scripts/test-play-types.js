const core = require('../src/game/core.js');
function card(suit, value){ return { suit, value }; }
function J(){ return card('joker', 15); }
function assert(cond, msg){ if(!cond) { console.error('FAIL:', msg); process.exit(1); } }

console.log('Running play-type tests...');

// Joker tests
assert(core.isSingleJoker([J()]), 'single joker should be recognized');
assert(!core.isSingleJoker([card('hearts',5)]), 'non-joker not single joker');
assert(core.isValidPlay([J()], [card('hearts',9)]), 'joker should beat non-joker pile');
assert(!core.isValidPlay([J()], [J()]), 'joker should not beat joker pile');
assert(core.isValidPlay([J()], [card('hearts',5)], undefined, undefined, { active: true, value: 5 }), 'joker should beat active four-of-a-kind challenge');

// Simple runs (singles)
assert(core.isRun([card('h',3), card('d',4), card('s',5)]), '3-4-5 run');
assert(core.isRun([card('h',4), card('d',5), card('s',6)]), '4-5-6 run');
assert(core.isValidPlay([card('h',5), card('d',6), card('s',7)], [card('h',4), card('d',5), card('s',6)]), '5-6-7 beats 4-5-6');
assert(!core.isValidPlay([card('h',5), card('d',6), card('s',7), card('c',8)], [card('h',4), card('d',5), card('s',6)]), 'longer run cannot beat shorter run by default');
// single-card adjacency allowed by engine: play one rank above or below last card
assert(core.isValidPlay([card('h',7)], [card('h',4), card('d',5), card('s',6)]), 'single-card adjacency above last run card allowed');
assert(core.isValidPlay([card('h',5)], [card('h',4), card('d',5), card('s',6)]), 'single-card adjacency below last run card allowed');

// Pair runs
const pairRunA = [card('h',3),card('d',3), card('h',4),card('d',4), card('h',5),card('d',5)];
const pairRunB = [card('s',4),card('c',4), card('s',5),card('c',5), card('s',6),card('c',6)];
assert(core.isRun(pairRunA), '33-44-55 is a pair-run');
assert(core.isRun(pairRunB), '44-55-66 is a pair-run');
assert(core.isValidPlay(pairRunB, pairRunA), '44-55-66 beats 33-44-55');

// Triple runs
const tripRunA = [];
for (const v of [3,4,5]) { for (let i=0;i<3;i++) tripRunA.push(card('h',v)); }
const tripRunB = [];
for (const v of [4,5,6]) { for (let i=0;i<3;i++) tripRunB.push(card('d',v)); }
assert(core.isRun(tripRunA), '333-444-555 is a trip-run');
assert(core.isValidPlay(tripRunB, tripRunA), '444-555-666 beats 333-444-555');

// Quads (four-of-a-kind) detection
assert(core.isFourOfAKind([card('h',7),card('d',7),card('s',7),card('c',7)]), 'four sevens detected as quads');
// A quad does not define a run under isRun
assert(!core.isRun([card('h',7),card('d',7),card('s',7),card('c',7)]), 'quad alone is not a run');

// Quad challenge: must be beaten by higher quad or joker
const quad5 = [card('h',5),card('d',5),card('s',5),card('c',5)];
const quad6 = [card('h',6),card('d',6),card('s',6),card('c',6)];
assert(core.isValidPlay(quad6, quad5, undefined, undefined, { active: true, value: 5 }), 'higher quad beats active quad challenge');
assert(core.isValidPlay([J()], quad5, undefined, undefined, { active: true, value: 5 }), 'joker beats active quad challenge');

// Invalid mixes
assert(!core.isRun([card('h',3), card('d',3), card('s',4), card('c',5)]), 'mixed multiplicity should not be a run');
assert(!core.isRun([card('h',3), card('d',4), card('s',6)]), 'gap in run invalid');

console.log('All play-type tests passed');
