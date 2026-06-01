/** Internal release nicknames — one per semver, assigned at bump time. */
export const BUILD_CODENAMES: Record<string, string> = {
  "1.0.0": "Shuffled Launch",
  "1.0.1": "Skip-Over Sally",
  "1.0.2": "Cloud Nine Club",
  "1.0.3": "Bounce-Back Betty",
  "1.0.4": "Release O'Clock",
  "1.0.5": "Patch Notes Diet",
  "1.0.6": "Avatar Poker Face",
  "1.0.7": "Shimmer & Tell",
  "1.0.8": "Scroll Bar Supreme",
  "1.0.9": "Vice Squad",
  "1.0.10": "Ghost Protocol",
  "1.0.11": "On Top, No Clip",
  "1.0.12": "Lightsaber Turn",
  "1.0.13": "Gold Pill Panic",
  "1.0.14": "Show Your Hand",
  "1.0.15": "Pool Noodle",
  "1.0.16": "Full House Party",
  "1.0.17": "Four Of A Kind Mind",
  "1.0.18": "Wild Draw Four Energy",
  "1.0.19": "Bottom Deck Energy",
  "1.0.20": "Ten High Drama",
  "1.0.21": "Bluff Buffet",
  "1.0.22": "Double Down Darling",
  "1.0.23": "Pile On Patrol",
  "1.0.24": "Underhand Overhand",
  "1.0.25": "Misdeal Mayhem",
  "1.0.26": "President's Day Off",
  "1.0.27": "Cut the Deck",
  "1.0.28": "Table Stakes Tantrum",
  "1.0.29": "High Card Hijinks",
  "1.0.30": "Rank And File",
  "1.0.31": "Your Turn, Apparently",
  "1.0.32": "Card Shark Week",
};

export function resolveBuildCodename(version: string): string | undefined {
  const key = version.trim();
  return BUILD_CODENAMES[key];
}
