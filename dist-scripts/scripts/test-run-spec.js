const core = require('../src/game/core.js');
function card(suit, value){ return { suit, value }; }
function assert(cond, msg){ if(!cond) { console.error('FAIL:', msg); process.exit(1); } }

console.log('Running run-spec tests...');

// Valid single run
assert(core.isRun([card('h',3), card('d',4), card('s',5)]), '3-4-5 should be a run');
// Valid pair run
assert(core.isRun([card('h',3), card('d',3), card('h',4), card('d',4), card('h',5), card('d',5)]), '33-44-55 should be a run');
// Invalid mixed multiplicity
assert(!core.isRun([card('h',3), card('d',3), card('h',4), card('h',5)]), '333-4-5 mixed multiplicity invalid');
// Invalid gap
assert(!core.isRun([card('h',3), card('d',4), card('s',6)]), '3-4-6 gap invalid');
// 2 not allowed
assert(!core.isRun([card('h',12), card('d',13), card('s',2)]), 'K-A-2 wrap invalid (2 forbidden)');
// Joker not allowed
assert(!core.isRun([card('h',11), card('d',12), card('j',15)]), 'J-Q-JOKER invalid');
// Ten not allowed
assert(!core.isRun([card('h',9), card('d',10), card('s',11)]), '10 in run invalid');
// A-high allowed
assert(core.isRun([card('h',12), card('d',13), card('s',14)]), 'Q-K-A should be allowed');

console.log('All run-spec tests passed');
