/**
 * Secret QA League bot table — only created when PS_QA_LEAGUE is enabled on the server.
 * @see QA_BOT_LEAGUE.md, scripts/qa/lib/spawnRules.mjs
 */

const botHosted = require('./botHostedRooms');

const QA_LEAGUE_ROOM_CODE = 'QALEG';

function isQALeagueServerEnabled() {
  const v = process.env.PS_QA_LEAGUE;
  return v === '1' || v === 'true' || String(v).toLowerCase() === 'yes';
}

/**
 * Private bot-hosted table for league socket runners (not listed on Find Game).
 * @param {import('./botHostedRooms')} ctx
 */
function ensureQALeagueRoomIfEnabled(ctx) {
  if (!isQALeagueServerEnabled()) return null;

  const room = botHosted.ensureBotHostedRoomAt(ctx, QA_LEAGUE_ROOM_CODE, {
    isPublic: false,
    isQALeague: true,
    roomName: '—',
    skipWhenHumanLobbies: false,
  });

  if (room) {
    console.log(
      `[Server] QA League room ${QA_LEAGUE_ROOM_CODE} ready (PS_QA_LEAGUE)`,
    );
  }
  return room;
}

module.exports = {
  QA_LEAGUE_ROOM_CODE,
  isQALeagueServerEnabled,
  ensureQALeagueRoomIfEnabled,
};
