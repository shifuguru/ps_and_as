import assert from "node:assert/strict";
import {
  buildTradesFromServerPending,
  type ClientPendingTrade,
} from "../src/game/roundPrep";
import { createGame } from "../src/game/core";
import {
  completedLocalRoleTrade,
  displayedLocalRoleTrade,
  localRoleTrade,
  roleTradeCardGroups,
  roleTradeKey,
  TRADE_RESULT_DISMISS_MS,
} from "../src/gameplayPresentation/roleTradePresentation";
import type { Card } from "../src/game/ruleset";

const incoming: Card[] = [
  { suit: "spades", value: 15 },
  { suit: "hearts", value: 14 },
];
const returned: Card[] = [
  { suit: "clubs", value: 3 },
  { suit: "diamonds", value: 4 },
];
const game = createGame(["President", "VP", "Middle", "VA", "Asshole"]);
const [president, vp, middle, va, asshole] = game.players;
const roles = {
  [president.id]: "president",
  [vp.id]: "vice_president",
  [va.id]: "vice_asshole",
  [asshole.id]: "asshole",
};
const trades = buildTradesFromServerPending(game.players, roles, {
  president: { fromId: asshole.id, count: 2, incoming, selected: returned },
  vicePresident: { fromId: va.id, count: 1, incoming: incoming.slice(0, 1), selected: null },
});

assert.deepEqual(trades[0].returnedCards, returned);
assert.equal(trades[0].completed, true);
assert.equal(trades[1].returnedCards, undefined);
assert.equal(localRoleTrade(trades, president.id), trades[0]);
assert.equal(localRoleTrade(trades, asshole.id), trades[0]);
assert.equal(localRoleTrade(trades, vp.id), trades[1]);
assert.equal(localRoleTrade(trades, va.id), trades[1]);
assert.equal(localRoleTrade(trades, middle.id), null);
assert.equal(localRoleTrade(trades, null), null);

const pending: ClientPendingTrade = { ...trades[0], completed: false, returnedCards: undefined };
const result = completedLocalRoleTrade(pending, asshole.id, returned);
assert.deepEqual(result?.incoming, incoming);
assert.deepEqual(result?.returnedCards, returned);
assert.equal(result?.completed, true);
assert.notEqual(result?.incoming, incoming);
assert.notEqual(result?.returnedCards, returned);
assert.equal(completedLocalRoleTrade(pending, middle.id, returned), null);
assert.equal(completedLocalRoleTrade(pending, president.id, returned), null);
assert.equal(completedLocalRoleTrade(pending, asshole.id, []), null);
const vpTrade: ClientPendingTrade = { ...trades[1], completed: false };
assert.equal(completedLocalRoleTrade(vpTrade, vp.id, returned.slice(0, 1)), null);
assert.equal(completedLocalRoleTrade(vpTrade, va.id, returned.slice(0, 1))?.completed, true);
assert.equal(displayedLocalRoleTrade(pending, null, null), pending);
assert.equal(displayedLocalRoleTrade(trades[0], null, null), null);
assert.equal(displayedLocalRoleTrade(pending, result, roleTradeKey(pending)), result);
assert.equal(displayedLocalRoleTrade(pending, null, roleTradeKey(pending)), null);
assert.equal(displayedLocalRoleTrade(vpTrade, null, roleTradeKey(pending)), vpTrade);
assert.equal(TRADE_RESULT_DISMISS_MS, 4000);
assert.deepEqual(roleTradeCardGroups(result!, asshole.id, []), [
  { label: "You give (best)", cards: incoming },
  { label: `From ${president.name}`, cards: returned },
]);
assert.deepEqual(roleTradeCardGroups(pending, president.id, returned), [
  { label: `From ${asshole.name}`, cards: incoming },
  { label: "You give", cards: returned },
]);
assert.deepEqual(roleTradeCardGroups(trades[1], va.id, [])[1].cards, []);
console.log("Role trade presentation tests passed");
