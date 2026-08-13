/** Curated in-game table chat — short Rocket League-style quick lines. */
const TABLE_CHAT_MESSAGES = [
  { id: 'nice-one', text: 'Nice one' },
  { id: 'good-play', text: 'Good play' },
  { id: 'well-played', text: 'Well played' },
  { id: 'nice-try', text: 'Nice try' },
  { id: 'oops', text: 'Oops' },
  { id: 'sorry', text: 'Sorry' },
  { id: 'my-bad', text: 'My bad' },
  { id: 'gg', text: 'GG' },
  { id: 'one-sec', text: 'One sec' },
  { id: 'brb', text: 'BRB' },
  { id: 'hurry-up', text: 'Hurry up' },
  { id: 'good-luck', text: 'Good luck' },
];

const TABLE_CHAT_BY_ID = Object.fromEntries(
  TABLE_CHAT_MESSAGES.map((entry) => [entry.id, entry.text]),
);

const TABLE_EMOTE_COOLDOWN_MS = 2500;

module.exports = {
  TABLE_CHAT_MESSAGES,
  TABLE_CHAT_BY_ID,
  TABLE_EMOTE_COOLDOWN_MS,
};
