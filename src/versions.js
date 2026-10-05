// Versions in quad notation, major.minor.build.revision, as the manifest writes them in Identity Version and in the
// MinVersion and MaxVersionTested of TargetDeviceFamily. Each part is a whole number from 0 to 65535 (16 bits), written
// in decimal digits with no sign and no leading zero, as the schema's version type spells it. A Windows build is the
// third part: 10.0.19041.0 is build 19041.

export const MAX_VERSION_LENGTH = 64;
export const MAX_PART = 65535;

// A quad version: { parts: [a, b, c, d] }, or { reason } when the text is not one.
export function parseQuad(text) {
  const s = String(text);
  if (s.length === 0) return { reason: 'it is empty' };
  if (s.length > MAX_VERSION_LENGTH) return { reason: `it is longer than ${MAX_VERSION_LENGTH} characters` };
  const pieces = s.split('.');
  if (pieces.length !== 4) return { reason: `it has ${pieces.length} part${pieces.length === 1 ? '' : 's'}, not four (major.minor.build.revision)` };
  const parts = [];
  for (const p of pieces) {
    if (p === '' || ![...p].every((c) => c >= '0' && c <= '9')) return { reason: `"${p.slice(0, 20)}" is not a whole number` };
    if (p.length > 1 && p[0] === '0') return { reason: `"${p.slice(0, 20)}" has a leading zero` };
    if (p.length > 5 || Number(p) > MAX_PART) return { reason: `${p.slice(0, 20)} is above ${MAX_PART}, the largest 16-bit part` };
    parts.push(Number(p));
  }
  return { parts };
}

// The order of two quad versions given as parts: below zero when a comes first.
export function compareQuad(a, b) {
  for (let i = 0; i < 4; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// The text of a quad version.
export const quadText = (parts) => parts.join('.');
