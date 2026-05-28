const BLOCKED = [
  'asshole',
  'assholes',
  'bastard',
  'bitch',
  'bitches',
  'bullshit',
  'cock',
  'crap',
  'cunt',
  'damn',
  'dick',
  'dicks',
  'fag',
  'faggot',
  'fuck',
  'fucker',
  'fucking',
  'fucks',
  'hell',
  'jackass',
  'motherfucker',
  'nazi',
  'nigga',
  'nigger',
  'penis',
  'piss',
  'pussy',
  'shit',
  'shits',
  'slut',
  'twat',
  'vagina',
  'whore',
];

function leetNormalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/8/g, 'b')
    .replace(/[({[]/g, 'c')
    .replace(/3/g, 'e')
    .replace(/6/g, 'g')
    .replace(/#/g, 'h')
    .replace(/1|!|\|/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't')
    .replace(/[^a-z0-9\s]/g, '');
}

function compactAlpha(text) {
  return leetNormalize(text).replace(/\s+/g, '');
}

function containsProfanity(text) {
  if (!text || !String(text).trim()) return false;
  const normalized = leetNormalize(text);
  const compact = compactAlpha(text);

  return BLOCKED.some((word) => {
    if (normalized.includes(word)) return true;
    if (compact.includes(word.replace(/\s+/g, ''))) return true;
    return false;
  });
}

function validateDisplayText(text, fieldLabel = 'This text') {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { ok: false, reason: `${fieldLabel} cannot be empty.` };
  }
  if (containsProfanity(trimmed)) {
    return {
      ok: false,
      reason: `${fieldLabel} contains language that isn't allowed. Please choose something else.`,
    };
  }
  return { ok: true, value: trimmed };
}

function normalizeRoomCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidRoomCode(code) {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

module.exports = {
  containsProfanity,
  validateDisplayText,
  normalizeRoomCode,
  isValidRoomCode,
};
