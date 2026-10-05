// The publisher of a package: a distinguished name such as "CN=Contoso Software, O=Contoso Corporation, C=US", which
// must be the subject of the certificate the package is signed with. The reader splits the name into its relative
// distinguished names, separated by commas (or plus signs inside one of them), each TYPE=value. A type is a short
// keyword of letters and digits or a dotted object identifier; a value is plain text with special characters escaped
// by a backslash, or text in double quotes. The name must hold a CN. The reader keeps a list of its own and no
// recursion, and reads each character once.

export const MAX_PUBLISHER_LENGTH = 8192;

const isLetter = (c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
const isDigit = (c) => c >= '0' && c <= '9';

// The parts of a distinguished name: { parts: [{ type, value, offset }] } with the offset of each type in the text,
// or { reason, offset }.
export function parseDn(text) {
  const s = String(text);
  if (s.trim() === '') return { reason: 'it is empty', offset: 0 };
  if (s.length > MAX_PUBLISHER_LENGTH) return { reason: `it is longer than ${MAX_PUBLISHER_LENGTH} characters`, offset: 0 };
  const parts = [];
  let i = 0;
  const n = s.length;
  for (;;) {
    while (i < n && s[i] === ' ') i += 1;
    const typeAt = i;
    while (i < n && (isLetter(s[i]) || isDigit(s[i]) || s[i] === '.' || s[i] === '-')) i += 1;
    const type = s.slice(typeAt, i);
    if (type === '') return { reason: typeAt >= n ? 'it ends with a separator and no TYPE=value after it' : `the character "${s[typeAt]}" where a type such as CN was expected`, offset: typeAt };
    const oid = isDigit(type[0]);
    if (oid ? !/^\d+(?:\.\d+)+$/.test(type) : !isLetter(type[0]) || type.includes('.')) return { reason: `"${type.slice(0, 20)}" is not a type such as CN, O or C`, offset: typeAt };
    while (i < n && s[i] === ' ') i += 1;
    if (s[i] !== '=') return { reason: `the type ${type.slice(0, 20)} has no = after it`, offset: i };
    i += 1;
    while (i < n && s[i] === ' ') i += 1;
    let value = '';
    if (s[i] === '"') {
      i += 1;
      for (;;) {
        if (i >= n) return { reason: `the quoted value of ${type.slice(0, 20)} is not closed`, offset: typeAt };
        if (s[i] === '\\' && i + 1 < n) {
          value += s[i + 1];
          i += 2;
        } else if (s[i] === '"') {
          i += 1;
          break;
        } else value += s[i++];
      }
      while (i < n && s[i] === ' ') i += 1;
    } else {
      while (i < n && s[i] !== ',' && s[i] !== '+' && s[i] !== ';') {
        if (s[i] === '\\') {
          if (i + 1 >= n) return { reason: 'a backslash at the end with nothing to escape', offset: i };
          value += s[i + 1];
          i += 2;
          continue;
        }
        if (s[i] === '"' || s[i] === '=' || s[i] === '<' || s[i] === '>') return { reason: `the character "${s[i]}" inside the value of ${type.slice(0, 20)}; put the value in double quotes or escape it with a backslash`, offset: i };
        value += s[i];
        i += 1;
      }
      // Spaces before a separator are not part of the value.
      value = value.trimEnd();
    }
    if (value === '') return { reason: `the type ${type.slice(0, 20)} has an empty value`, offset: typeAt };
    parts.push({ type, value, offset: typeAt });
    if (i >= n) break;
    if (s[i] === ';') return { reason: 'a semicolon between parts; separate them with commas', offset: i };
    if (s[i] !== ',' && s[i] !== '+') return { reason: `the character "${s[i]}" after the value of ${type.slice(0, 20)}`, offset: i };
    i += 1;
  }
  if (!parts.some((p) => p.type.toUpperCase() === 'CN')) return { reason: 'it has no CN (common name), which a publisher needs', offset: 0 };
  return { parts };
}

// Why two distinguished names differ, for a message, or null when the texts are the same. The texts are compared
// exactly; the reason names the first part that differs, or says that only the spacing or the order differs.
export function dnDifference(manifest, subject) {
  if (manifest === subject) return null;
  const a = parseDn(manifest);
  const b = parseDn(subject);
  if (!a.parts || !b.parts) return 'the texts differ';
  const key = (p) => `${p.type.toUpperCase()}=${p.value}`;
  const ka = a.parts.map(key);
  const kb = b.parts.map(key);
  if (ka.join(',') === kb.join(',')) return 'the parts are the same but the text differs in its spacing or quoting; Windows compares the text';
  if ([...ka].sort().join(',') === [...kb].sort().join(',')) return 'the parts are the same but in another order; Windows compares the text';
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i += 1) {
    const x = a.parts[i];
    const y = b.parts[i];
    if (!x) return `the certificate subject has ${y.type}=${y.value} that the manifest does not`;
    if (!y) return `the manifest has ${x.type}=${x.value} that the certificate subject does not`;
    if (key(x) !== key(y)) {
      if (x.type.toUpperCase() === y.type.toUpperCase()) return `the ${y.type} is "${x.value}" in the manifest and "${y.value}" in the certificate subject`;
      return `the manifest has ${x.type}=${x.value} where the certificate subject has ${y.type}=${y.value}`;
    }
  }
  return 'the texts differ';
}
