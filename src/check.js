// A run: read the configuration, list the folders and files named, read each manifest, check it, look for the asset
// files it names under --root, and build the report of the run. A path on the command line that cannot be used
// (missing, a link, a root that is not a folder), a --cert-subject that is not a distinguished name or a configuration
// with a problem stops the run with an InputError and no result. A manifest that cannot be read, and input past the
// limits of a run, are error findings of their own, so the run fails at the default level and never passes because a
// part of the input was passed over.

import { join } from 'node:path';
import { findAsset } from './assets.js';
import { ConfigError, defaultConfig, readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, inspectPath, readText, readTextFile } from './files.js';
import { lineStarts, positionOf } from './json.js';
import { MANIFEST_LIMITS, ManifestError, readManifest } from './manifest.js';
import { parseDn } from './publisher.js';
import { RULES, atOrAbove, decide } from './rules.js';
import { grouped, plural } from './size.js';
import { safeText } from './text.js';
import { WALK_LIMITS, listEntries, listFolder } from './walk.js';
import { byCode, joinPath } from './words.js';
import { XmlError } from './xml.js';

export const LIMITS = { ...FILE_LIMITS, ...WALK_LIMITS, ...MANIFEST_LIMITS, maxManifests: 200, maxFindingsPerRule: 500, maxInputs: 100 };
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// A list of problems for an error message: the first twenty, then a count.
export function capped(problems) {
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `and ${grouped(problems.length - MAX_PROBLEMS)} more`] : problems;
}

// The level of a rule under a configuration: the rules of input problems are always errors.
export function levelOf(rule, config) {
  return rule.key === null ? 'error' : config.rules[rule.key];
}

// Reads one manifest: { result, findings: [{ rule, offset, found }], place, encoding } where result is what
// readManifest() gives and place gives the line and column of an offset. A file that cannot be read gives one
// unreadable-manifest finding and no result.
export async function readOne(full, shown, { config, certSubject = null, maxBytes = LIMITS.maxManifestBytes, limits = LIMITS } = {}) {
  let text;
  let encoding = null;
  try {
    ({ text, encoding } = await readText(full, shown, maxBytes));
  } catch (error) {
    return { result: null, encoding, findings: [{ rule: 'unreadable-manifest', offset: 0, found: `the file cannot be read: ${error.reason ?? error.message}; nothing in it is checked` }], place: () => ({ line: 1, column: 1 }) };
  }
  const starts = lineStarts(text);
  const place = (offset) => positionOf(starts, Math.max(0, Math.min(offset, text.length)));
  try {
    const result = readManifest(text, { config, certSubject, lineOf: (o) => place(o).line, limits });
    return { result, encoding, findings: result.findings, place };
  } catch (error) {
    if (error instanceof XmlError || error instanceof ManifestError) {
      return { result: null, encoding, findings: [{ rule: 'unreadable-manifest', offset: error.offset, found: `the file cannot be read as a package manifest: ${error.reason}; nothing in it is checked` }], place };
    }
    throw error;
  }
}

// The run as a report object. inputs is what was named and listed; manifests are the manifests read, [{ file,
// summary }]; raw are the findings, [{ rule, file, line, column, found }].
export function buildReport({ inputs, manifests, raw, config, certSubject, root, minSeverity, failOn, version, notes: extraNotes = [], limits = LIMITS }) {
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  const level = (id) => levelOf(RULES.find((r) => r.id === id), config);
  const all = raw
    .filter((f) => level(f.rule) !== 'off')
    .map((f) => ({ ...f, level: level(f.rule) }))
    .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || byCode(a.file, b.file) || a.line - b.line || a.column - b.column || ruleOrder.get(a.rule) - ruleOrder.get(b.rule));
  const shown = all.filter((f) => atOrAbove(f.level, minSeverity));
  const hidden = all.length - shown.length;
  const perRule = new Map();
  const findings = [];
  let cut = 0;
  for (const f of shown) {
    const n = (perRule.get(f.rule) ?? 0) + 1;
    perRule.set(f.rule, n);
    if (n > limits.maxFindingsPerRule) {
      cut += 1;
      continue;
    }
    const rule = RULES.find((r) => r.id === f.rule);
    findings.push({
      rule: f.rule,
      level: f.level,
      file: safeText(f.file),
      line: f.line,
      column: f.column,
      at: `${safeText(f.file)}:${f.line}`,
      found: safeText(f.found, 800),
      fix: rule.fix,
      basis: rule.basis.map((k) => ({ text: POINTS[k].text, source: pointPage(k).title, url: pointPage(k).url })),
      own: rule.own
    });
  }
  const result = decide(shown, failOn);
  const clean = (v, max = 200) => (v === null || v === undefined ? null : safeText(v, max));
  const shownManifests = manifests.map((m) => {
    const mine = all.filter((x) => x.file === m.file);
    const byLevel = { error: 0, warning: 0, info: 0 };
    for (const x of mine) byLevel[x.level] += 1;
    const s = m.summary;
    return {
      file: safeText(m.file),
      read: s !== null,
      encoding: m.encoding,
      name: s ? clean(s.name, 120) : null,
      publisher: s ? clean(s.publisher, 300) : null,
      displayName: s ? clean(s.displayName, 120) : null,
      version: s ? clean(s.version, 64) : null,
      architecture: s ? clean(s.architecture, 40) : null,
      devices: s ? s.devices.map((d) => ({ name: clean(d.name, 80), min: clean(d.min, 64), max: clean(d.max, 64), minBuild: d.minBuild, maxBuild: d.maxBuild })) : [],
      capabilities: s ? Object.fromEntries(Object.entries(s.capabilities).map(([g, list]) => [g, list.map((x) => safeText(x, 64))])) : null,
      allowedRestricted: s ? s.allowedRestricted.map((x) => safeText(x, 64)) : [],
      applications: s ? s.applications.map((a) => ({ id: clean(a.id, 64), executable: clean(a.executable, 120), entryPoint: clean(a.entryPoint, 120) })) : [],
      extensions: s ? s.extensions.map((x) => safeText(x, 120)) : [],
      languages: s ? s.languages.map((x) => safeText(x, 64)) : [],
      findings: mine.length,
      byLevel
    };
  });
  const rules = RULES.map((r) => ({ id: r.id, level: level(r.id), findings: all.filter((f) => f.rule === r.id).length }));
  const notes = [];
  if (!manifests.length) notes.push('the input holds no package manifest');
  if (inputs.links) notes.push(`${plural(inputs.links, 'symbolic link')} ${inputs.links === 1 ? 'is' : 'are'} not followed`);
  notes.push(...extraNotes);
  if (cut) notes.push(`${plural(cut, 'finding')} past the limit of ${grouped(limits.maxFindingsPerRule)} per rule ${cut === 1 ? 'is' : 'are'} counted but not listed`);
  if (hidden) notes.push(`${plural(hidden, 'finding')} below ${minSeverity} ${hidden === 1 ? 'is' : 'are'} not shown`);
  const off = RULES.filter((r) => r.key !== null && levelOf(r, config) === 'off');
  if (off.length) notes.push(`${plural(off.length, 'rule')} ${off.length === 1 ? 'is' : 'are'} off: ${off.map((r) => r.id).join(', ')}`);
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.level] += 1;
  return {
    tool: 'msix-manifest-check',
    version,
    input: {
      paths: inputs.paths.map((p) => safeText(p)),
      folders: inputs.folders,
      files: inputs.files,
      manifests: manifests.length,
      otherFiles: inputs.others,
      foldersPassedOver: inputs.subfolders,
      links: inputs.links,
      root: root ? safeText(root) : null,
      certSubject: certSubject === null ? null : safeText(certSubject, 300)
    },
    config: {
      file: config.file === null ? null : safeText(config.file),
      name: config.name === null ? null : safeText(config.name, 120),
      minBuildFloor: config.minBuildFloor,
      allowedRestrictedCapabilities: config.allowedRestrictedCapabilities,
      reservedProtocols: config.reservedProtocols,
      minSeverity,
      failOn,
      rules: RULES.map((r) => ({ id: r.id, key: r.key, level: levelOf(r, config), rule: safeText(r.rule(config), 600) }))
    },
    manifests: shownManifests,
    rules,
    findings,
    totals: { findings: shown.length, byLevel, hidden, notListed: cut, manifests: shownManifests.length },
    result,
    notes: notes.map((n) => safeText(n, 600)),
    notice: NOTICE
  };
}

// The manifests named on the command line: folders are listed, files kept as they are. Returns { list, inputs,
// problems } where list is [{ full, shown }].
async function gather(paths, base, lim) {
  const problems = [];
  const list = [];
  const inputs = { paths: [], folders: 0, files: 0, others: 0, subfolders: 0, links: 0, limits: [] };
  const seen = new Set();
  for (const p of paths) {
    let info;
    try {
      info = await inspectPath(p, base);
    } catch (error) {
      problems.push(error.message);
      continue;
    }
    if (seen.has(info.full)) {
      problems.push(`${info.shown}: is named twice`);
      continue;
    }
    seen.add(info.full);
    inputs.paths.push(info.shown);
    if (info.folder) {
      inputs.folders += 1;
      let listed;
      try {
        listed = await listFolder(info.full, { limits: lim });
      } catch (error) {
        problems.push(`${info.shown}: the folder cannot be read (${error.code ?? error.message})`);
        continue;
      }
      inputs.others += listed.others;
      inputs.subfolders += listed.folders;
      inputs.links += listed.links;
      if (listed.limit) inputs.limits.push({ shown: info.shown, limit: listed.limit });
      for (const f of listed.manifests) {
        const shown = joinPath(info.shown, f.name);
        if (seen.has(f.full)) continue;
        seen.add(f.full);
        list.push({ full: f.full, shown });
      }
    } else {
      inputs.files += 1;
      list.push({ full: info.full, shown: info.shown });
    }
  }
  return { list, inputs, problems };
}

// The listing of folders under the root, by their parts, each listed once in a run. A folder that is not there gives
// null; a folder past the limit of entries is noted.
function rootLister(rootFull, lim, limited) {
  const cache = new Map();
  return (parts) => {
    const key = parts.join('/');
    if (!cache.has(key)) {
      cache.set(key, listEntries(join(rootFull, ...parts), { limits: lim }).then((r) => {
        if (r.limit) limited.add(key || '.');
        return r;
      }, (error) => {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
      }));
    }
    return cache.get(key);
  };
}

// Reads the inputs, runs every check and builds the report object of the run.
export async function checkPaths({ paths, root: rootPath = null, certSubject = null, config: configPath = null, minSeverity = null, failOn = null, version = '0.0.0', limits = LIMITS, base = process.cwd() }) {
  const lim = { ...LIMITS, ...limits };
  let config;
  try {
    if (configPath) {
      const c = await readTextFile(configPath, base, lim.maxConfigBytes);
      config = readConfig(c.text, c.file);
    } else config = defaultConfig();
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(capped(error.problems));
    throw new InputError([error.message]);
  }
  const { list, inputs, problems } = await gather(paths, base, lim);
  if (certSubject !== null) {
    const dn = parseDn(certSubject);
    if (!dn.parts) problems.push(`--cert-subject "${certSubject.slice(0, 120)}" is not a distinguished name: ${dn.reason}`);
  }
  let root = null;
  if (rootPath !== null) {
    try {
      const info = await inspectPath(rootPath, base);
      if (!info.folder) problems.push(`--root ${info.shown}: is a file; give the folder the asset paths of the manifest start from`);
      else root = info;
    } catch (error) {
      problems.push(`--root ${error.message}`);
    }
  }
  if (problems.length) throw new InputError(capped(problems));

  const raw = [];
  const manifests = [];
  for (const l of inputs.limits) raw.push({ rule: 'scan-limit', file: l.shown, line: 1, column: 1, found: `the folder holds ${l.limit}; the listing stopped there, and the rest of the folder is not read` });
  let read = list;
  if (list.length > lim.maxManifests) {
    raw.push({ rule: 'scan-limit', file: inputs.paths[0], line: 1, column: 1, found: `the input holds more than ${grouped(lim.maxManifests)} manifests; the first ${grouped(lim.maxManifests)} are read and the rest is not` });
    read = list.slice(0, lim.maxManifests);
  }
  const limited = new Set();
  const lister = root ? rootLister(root.full, lim, limited) : null;
  let assetsLooked = 0;
  for (const m of read) {
    const r = await readOne(m.full, m.shown, { config, certSubject, maxBytes: lim.maxManifestBytes, limits: lim });
    for (const x of r.findings) raw.push({ rule: x.rule, file: m.shown, ...r.place(x.offset), found: x.found });
    if (r.result && r.result.assets.length >= lim.maxAssets) raw.push({ rule: 'scan-limit', file: m.shown, line: 1, column: 1, found: `the manifest names more than ${grouped(lim.maxAssets)} asset files; the rest are not looked for` });
    if (r.result && lister) {
      for (const a of r.result.assets) {
        assetsLooked += 1;
        const found = await findAsset(a.path, lister);
        if (!found.found) raw.push({ rule: 'missing-asset', file: m.shown, ...r.place(a.offset), found: `the path "${a.path.slice(0, 160)}" (${a.what}) is not under the root ${root.shown}: ${found.reason}` });
      }
    }
    manifests.push({ file: m.shown, summary: r.result ? r.result.summary : null, encoding: r.encoding });
  }
  for (const key of limited) raw.push({ rule: 'scan-limit', file: root.shown, line: 1, column: 1, found: `the folder ${key} under the root holds more entries than the limit; the listing stopped there, so a file past it is reported as missing` });
  const notes = [];
  if (!root) notes.push('--root is not given, so the asset files the manifests name are not looked for');
  else notes.push(`${plural(assetsLooked, 'asset path')} looked for under ${root.shown}`);
  if (certSubject === null) notes.push('--cert-subject is not given, so the publisher is not compared with a signing certificate');
  return buildReport({
    inputs,
    manifests,
    raw,
    config,
    certSubject,
    root: root ? root.shown : null,
    minSeverity: minSeverity ?? config.minSeverity,
    failOn: failOn ?? config.failOn,
    version,
    notes,
    limits: lim
  });
}
