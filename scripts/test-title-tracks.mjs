/**
 * Title track tier resolution — long-game thresholds.
 * Run: npx tsx scripts/test-title-tracks.mjs
 */
import {
  luckyTitlePoints,
  titleTrackProgress,
  TITLE_TRACKS,
  unlockedTitleTracks,
} from "../src/rewards/titleTracks.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const emptyStats = {
  roundsPlayed: 0,
  timesPresident: 0,
  timesVicePresident: 0,
  timesViceAsshole: 0,
  timesAsshole: 0,
  presidentStreak: 0,
  bestPresidentStreak: 0,
  xp: 0,
  tricksWon: 0,
  gamesWon: 0,
  gamesLost: 0,
  jokersReceivedInDeal: 0,
  jokersReceivedInTrade: 0,
  jokersGivenInTrade: 0,
};

const lucky = TITLE_TRACKS.find((t) => t.id === "lucky");
assert(lucky, "lucky track exists");

assert(titleTrackProgress(emptyStats, lucky).tier === 0, "fresh player locked");

const fiveWins = { ...emptyStats, gamesWon: 5 };
assert(luckyTitlePoints(fiveWins) === 50_000, "5 wins = 50k lucky points");
assert(titleTrackProgress(fiveWins, lucky).tier === 1, "tier 1 at 50k");
assert(
  titleTrackProgress(fiveWins, lucky).displayTitle === "Charmed",
  "tier 1 title",
);

const earlyPresident = { ...emptyStats, timesPresident: 3 };
const president = TITLE_TRACKS.find((t) => t.id === "president");
assert(president, "president track exists");
assert(
  titleTrackProgress(earlyPresident, president).tier === 0,
  "3 presidents still locked (need 25)",
);

const veteranPresident = { ...emptyStats, timesPresident: 25 };
assert(
  titleTrackProgress(veteranPresident, president).tier === 1,
  "25 presidents tier 1",
);

assert(unlockedTitleTracks(emptyStats).length === 0, "no tracks at start");

console.log("test-title-tracks: ok");
