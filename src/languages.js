// Language tags as BCP 47 writes them (RFC 5646): language, then an optional script, region, variants, extensions and
// a private use part, separated by hyphens, compared without regard to case; or one of the grandfathered tags. The
// check is of the form only (a well-formed tag); whether each subtag is in the IANA registry is not checked, because
// the tool carries no copy of the registry. "x-generate", which Visual Studio replaces with the languages of a project
// when it builds the package, is a private use tag and well formed.

export const MAX_TAG_LENGTH = 128;

// The grandfathered tags of RFC 5646, lowercase.
const GRANDFATHERED = new Set([
  'en-gb-oed', 'i-ami', 'i-bnn', 'i-default', 'i-enochian', 'i-hak', 'i-klingon', 'i-lux', 'i-mingo', 'i-navajo', 'i-pwn',
  'i-tao', 'i-tay', 'i-tsu', 'sgn-be-fr', 'sgn-be-nl', 'sgn-ch-de',
  'art-lojban', 'cel-gaulish', 'no-bok', 'no-nyn', 'zh-guoyu', 'zh-hakka', 'zh-min', 'zh-min-nan', 'zh-xiang'
]);

const alpha = (s) => s.length > 0 && [...s].every((c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
const digits = (s) => s.length > 0 && [...s].every((c) => c >= '0' && c <= '9');
const alnum = (s) => s.length > 0 && [...s].every((c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'));

// Why a text is not a well-formed language tag, or null when it is one.
export function languageTagProblem(tag) {
  const s = String(tag);
  if (s === '') return 'it is empty';
  if (s.length > MAX_TAG_LENGTH) return `it is longer than ${MAX_TAG_LENGTH} characters`;
  if (GRANDFATHERED.has(s.toLowerCase())) return null;
  if (!alnum(s.split('-').join(''))) return 'it holds a character other than letters, digits and hyphens; BCP 47 separates subtags with a hyphen';
  const t = s.split('-');
  if (t.some((x) => x === '')) return 'it has an empty subtag (two hyphens, or a hyphen at an end)';
  if (t.some((x) => x.length > 8)) return 'a subtag is longer than eight characters';
  let i = 0;
  const lower = (x) => x.toLowerCase();
  if (lower(t[0]) === 'x') {
    if (t.length < 2) return 'a private use tag needs a subtag after x-';
    return null;
  }
  // language: 2 to 3 letters with up to three extlang subtags of 3 letters, or 4 to 8 letters
  if (!alpha(t[0]) || t[0].length < 2) return `"${t[0].slice(0, 12)}" is not a language subtag of two to eight letters`;
  i = 1;
  if (t[0].length <= 3) {
    let ext = 0;
    while (i < t.length && ext < 3 && t[i].length === 3 && alpha(t[i])) {
      i += 1;
      ext += 1;
    }
  }
  if (i < t.length && t[i].length === 4 && alpha(t[i])) i += 1;
  if (i < t.length && ((t[i].length === 2 && alpha(t[i])) || (t[i].length === 3 && digits(t[i])))) i += 1;
  const variants = new Set();
  while (i < t.length && ((t[i].length >= 5 && alnum(t[i])) || (t[i].length === 4 && digits(t[i][0]) && alnum(t[i])))) {
    if (variants.has(lower(t[i]))) return `the variant ${t[i]} appears twice`;
    variants.add(lower(t[i]));
    i += 1;
  }
  const singletons = new Set();
  while (i < t.length && t[i].length === 1 && lower(t[i]) !== 'x') {
    if (singletons.has(lower(t[i]))) return `the extension ${t[i]} appears twice`;
    singletons.add(lower(t[i]));
    i += 1;
    const start = i;
    while (i < t.length && t[i].length >= 2) i += 1;
    if (i === start) return `the extension ${t[start - 1]} has no subtag of two to eight characters after it`;
  }
  if (i < t.length && lower(t[i]) === 'x') {
    if (i + 1 >= t.length) return 'a private use part needs a subtag after x-';
    return null;
  }
  if (i < t.length) return `"${t[i].slice(0, 12)}" is not in the place of a script (four letters), a region (two letters or three digits), a variant or an extension`;
  return null;
}
