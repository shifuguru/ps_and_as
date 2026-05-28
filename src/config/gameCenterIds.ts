/**
 * Map in-app keys → App Store Connect Game Center IDs.
 * Create matching achievements/leaderboards in App Store Connect and paste IDs here.
 *
 * @see https://appstoreconnect.apple.com → your app → Game Center
 */
const BUNDLE = "com.anonymous.ps_and_as";

export const GAME_CENTER_ACHIEVEMENTS: Record<string, string> = {
  debut: `${BUNDLE}.achievement.debut`,
  president: `${BUNDLE}.achievement.president`,
  asshole: `${BUNDLE}.achievement.asshole`,
  vice_president: `${BUNDLE}.achievement.vice_president`,
  vice_asshole: `${BUNDLE}.achievement.vice_asshole`,
  hot_streak: `${BUNDLE}.achievement.hot_streak`,
  veteran: `${BUNDLE}.achievement.veteran`,
  dynasty: `${BUNDLE}.achievement.dynasty`,
};

export const GAME_CENTER_LEADERBOARDS: Record<string, string> = {
  president_wins: `${BUNDLE}.leaderboard.president_wins`,
  rounds_played: `${BUNDLE}.leaderboard.rounds_played`,
};
