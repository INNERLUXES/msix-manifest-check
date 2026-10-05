// The configuration file: the settings of the tool, in one strict JSON object over the built-in defaults. Every key the
// tool does not know is an error with its line and a suggestion, so a typo cannot leave a default in place unnoticed;
// the JSON reader refuses a name given twice in one object. The configuration is optional: with none, the defaults
// apply.

import { LEVELS } from './data.js';
import { DEFAULT_ALLOWED_RESTRICTED, DEFAULT_FAIL_ON, DEFAULT_MIN_BUILD_FLOOR, DEFAULT_MIN_SEVERITY, DEFAULT_RESERVED_PROTOCOLS, DEFAULT_RULES } from './defaults.js';
import { JsonError, jsonProblem, parseJson } from './json.js';
import { parseQuad } from './versions.js';
import { asciiLower } from './words.js';

export const CONFIG_LIMITS = { maxListEntries: 100 };

// Every key of the configuration file, with the kind of its value. docs/inputs.md describes each of them.
export const KEYS = {
  name: 'text',
  rules: Object.fromEntries(Object.keys(DEFAULT_RULES).map((k) => [k, 'level or off'])),
  minBuildFloor: 'quad version',
  allowedRestrictedCapabilities: 'list of capability names',
  reservedProtocols: 'list of protocol names or prefixes',
  minSeverity: 'level',
  failOn: 'level'
};

export class ConfigError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// The edit distance of two short names, for a suggestion: an insertion, a deletion, a change or two neighbours swapped
// ("nmae" for "name") each count one.
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The closest of the known names, when it is close enough to be a typo: '; did you mean "..."?' or nothing. A name that
// differs in length from a known name by more than three characters, or that is longer than 64 characters, is not
// compared with it.
export function suggestion(name, known) {
  if (name.length > 64) return '';
  let best = null;
  for (const k of known) {
    if (Math.abs(name.length - k.length) > 3 || k.length > 64) continue;
    const d = distance(asciiLower(name), asciiLower(k));
    if (d <= Math.max(1, Math.floor(k.length / 3)) && (!best || d < best.d)) best = { k, d };
  }
  return best ? `; did you mean "${best.k}"?` : '';
}

export function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A capability name: a letter, then letters and digits, up to 64 characters.
export const isCapabilityName = (text) => /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(text);

// A reserved protocol entry: a lowercase scheme, or the start of one followed by *.
export const isProtocolEntry = (text) => /^[a-z][a-z0-9+.-]{0,62}\*?$/.test(text);

// The built-in configuration, as the checks use it.
export function defaultConfig() {
  return {
    file: null,
    name: null,
    rules: { ...DEFAULT_RULES },
    minBuildFloor: DEFAULT_MIN_BUILD_FLOOR,
    allowedRestrictedCapabilities: [...DEFAULT_ALLOWED_RESTRICTED],
    reservedProtocols: [...DEFAULT_RESERVED_PROTOCOLS],
    minSeverity: DEFAULT_MIN_SEVERITY,
    failOn: DEFAULT_FAIL_ON
  };
}

// The built-in configuration written as a configuration file, for --print-defaults. Read back, it gives the defaults.
export function defaultsAsConfig() {
  const d = defaultConfig();
  return { name: 'built-in defaults', rules: d.rules, minBuildFloor: d.minBuildFloor, allowedRestrictedCapabilities: d.allowedRestrictedCapabilities, reservedProtocols: d.reservedProtocols, minSeverity: d.minSeverity, failOn: d.failOn };
}

// Checks a parsed configuration and builds the configuration the checks use, or throws ConfigError with every problem.
export function validateConfig(value, lines = new Map(), file = 'config') {
  const problems = [];
  const lineOf = (path) => {
    for (let p = path, prev = null; p && p !== prev; prev = p, p = p.replace(/(?:\.[^.[]+|\[\d+\])$/, '')) if (lines.has(p)) return lines.get(p);
    return 1;
  };
  const fail = (path, message) => problems.push({ line: lineOf(path), text: `${file}: line ${lineOf(path)}: ${message}` });
  const config = defaultConfig();
  config.file = file;
  if (!isObject(value)) throw new ConfigError([`${file}: line 1: the configuration must be a JSON object, not ${kindOf(value)}`]);
  const show = (v) => (typeof v === 'string' ? `"${v.slice(0, 40)}"` : kindOf(v));

  const top = Object.keys(KEYS);
  for (const k of Object.keys(value)) if (!top.includes(k)) fail(k, `"${k.slice(0, 60)}" is not a key of the configuration${suggestion(k, top)}`);

  if (Object.hasOwn(value, 'name')) {
    if (typeof value.name !== 'string' || value.name.trim().length === 0 || value.name.length > 120) fail('name', 'name must be a text of 1 to 120 characters');
    else config.name = value.name;
  }

  if (Object.hasOwn(value, 'rules')) {
    const v = value.rules;
    const keys = Object.keys(DEFAULT_RULES);
    const levels = [...LEVELS, 'off'];
    if (!isObject(v)) fail('rules', `rules must be an object, not ${kindOf(v)}`);
    else {
      for (const k of Object.keys(v)) {
        const path = `rules.${k}`;
        if (!keys.includes(k)) fail(path, `"${k.slice(0, 60)}" is not a key of rules${suggestion(k, keys)}`);
        else if (typeof v[k] !== 'string' || !levels.includes(v[k])) fail(path, `${path} must be one of ${levels.join(', ')}, not ${typeof v[k] === 'number' ? String(v[k]) : show(v[k])}`);
        else config.rules[k] = v[k];
      }
    }
  }

  if (Object.hasOwn(value, 'minBuildFloor')) {
    const v = value.minBuildFloor;
    const q = typeof v === 'string' ? parseQuad(v) : null;
    if (!q || !q.parts) fail('minBuildFloor', `minBuildFloor must be a quad version such as "10.0.17763.0", not ${show(v)}${q ? `: ${q.reason}` : ''}`);
    else config.minBuildFloor = v;
  }

  const lists = {
    allowedRestrictedCapabilities: (x) => (isCapabilityName(x) ? null : `"${x.slice(0, 40)}" is not the name of a capability, such as runFullTrust`),
    reservedProtocols: (x) => (isProtocolEntry(x) ? null : `"${x.slice(0, 40)}" is not a lowercase protocol name, or the start of one followed by *, such as ms-*`)
  };
  for (const [key, check] of Object.entries(lists)) {
    if (!Object.hasOwn(value, key)) continue;
    const list = value[key];
    if (!Array.isArray(list)) {
      fail(key, `${key} must be a list, not ${kindOf(list)}`);
      continue;
    }
    if (list.length > CONFIG_LIMITS.maxListEntries) {
      fail(key, `${key} holds more than ${CONFIG_LIMITS.maxListEntries} entries`);
      continue;
    }
    const out = [];
    list.forEach((x, i) => {
      const p = `${key}[${i}]`;
      if (typeof x !== 'string') fail(p, `${p} must be a text, not ${kindOf(x)}`);
      else if (check(x)) fail(p, `${p}: ${check(x)}`);
      else if (!out.includes(x)) out.push(x);
    });
    config[key] = out;
  }

  for (const key of ['minSeverity', 'failOn']) {
    if (!Object.hasOwn(value, key)) continue;
    if (!LEVELS.includes(value[key])) fail(key, `${key} must be one of ${LEVELS.join(', ')}`);
    else config[key] = value[key];
  }
  // The problems in the order of their lines, so the list reads like the file.
  if (problems.length) throw new ConfigError(problems.sort((a, b) => a.line - b.line).map((p) => p.text));
  return config;
}

// Reads the text of a configuration file.
export function readConfig(text, file) {
  let parsed;
  try {
    parsed = parseJson(text, { linesUpTo: 3 });
  } catch (error) {
    if (error instanceof JsonError) throw new ConfigError([`${file}: ${jsonProblem(error, text)}`]);
    throw error;
  }
  return validateConfig(parsed.value, parsed.lines, file);
}
