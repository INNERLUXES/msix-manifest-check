// The reports: text for a terminal, JSON for other tools, and GitHub workflow commands that turn each finding into an
// annotation on the file, line and column. The CSV report is in src/csv.js. Every text from the input (a file name, a
// name, a version) was cleaned by safeText before it reached the report object. The GitHub commands also escape the
// characters a command gives a meaning to, so a text in the input cannot end a command early or start another one.

import { GROUPS } from './capabilities.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

const clean = (t, max = 200) => safeText(t, max);

function inputLine(r) {
  const i = r.input;
  return [`${plural(i.folders, 'folder')} and ${plural(i.files, 'file')} named`, plural(i.manifests, 'manifest'), `${plural(i.otherFiles, 'other file')} passed over`, `${plural(i.foldersPassedOver, 'folder')} inside passed over`, `${plural(i.links, 'link')} not followed`].join('; ');
}

const rootLine = (r) => (r.input.root ? `${r.input.root}; the asset files the manifests name are looked for under it` : 'not given; asset files are not looked for');
const subjectLine = (r) => (r.input.certSubject !== null ? r.input.certSubject : 'not given; the publisher is not compared with a signing certificate');

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${clean(c.name, 120)})` : ''}` : 'built-in defaults';
  const allowed = c.allowedRestrictedCapabilities.length ? listText(c.allowedRestrictedCapabilities, 20) : 'none';
  const reserved = c.reservedProtocols.length ? listText(c.reservedProtocols, 20) : 'none';
  return `${where}: minimum build ${c.minBuildFloor}; restricted capabilities allowed ${allowed}; reserved protocols ${reserved}; minimum severity ${c.minSeverity}; fail on ${c.failOn}`;
}

const rulesLine = (r) => r.config.rules.map((x) => `${x.id} (${x.level})`).join('; ');

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// A table with a header row and its columns padded to the widest cell.
function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const cell = (t, max = 60) => (t === '' || t === null || t === undefined ? '-' : clean(t, max));
const PAD = ' '.repeat(11);

// The lowest MinVersion build and the highest MaxVersionTested build of a manifest, for the table.
function builds(m) {
  const mins = m.devices.map((d) => d.minBuild).filter((b) => b !== null);
  const maxes = m.devices.map((d) => d.maxBuild).filter((b) => b !== null);
  return [mins.length ? String(Math.min(...mins)) : '-', maxes.length ? String(Math.max(...maxes)) : '-'];
}

// The lines of the summary of one manifest.
function summaryLines(m) {
  const out = [`  ${m.file}`];
  if (!m.read) return [...out, '    not read', ''];
  out.push(`    identity: ${cell(m.name, 120)}; publisher ${cell(m.publisher, 300)}`);
  out.push(`    version: ${cell(m.version, 64)}; architecture ${cell(m.architecture, 40)}; display name ${cell(m.displayName, 120)}`);
  if (!m.devices.length) out.push('    Windows: no TargetDeviceFamily');
  for (const d of m.devices) out.push(`    Windows: ${cell(d.name, 80)} MinVersion ${cell(d.min, 64)}${d.minBuild !== null ? ` (build ${d.minBuild})` : ''}, MaxVersionTested ${cell(d.max, 64)}${d.maxBuild !== null ? ` (build ${d.maxBuild})` : ''}`);
  const caps = GROUPS.map((g) => `${g} ${m.capabilities[g].length ? m.capabilities[g].join(', ') : 'none'}`);
  out.push(`    capabilities: ${caps.join('; ')}`);
  if (m.allowedRestricted.length) out.push(`    allowed by the configuration: ${m.allowedRestricted.join(', ')}`);
  out.push(`    applications: ${m.applications.length ? m.applications.map((a) => `${cell(a.id, 64)} (${cell(a.executable, 120)})`).join(', ') : 'none'}`);
  out.push(`    extensions: ${m.extensions.length ? m.extensions.join(', ') : 'none'}`);
  out.push(`    languages: ${m.languages.length ? m.languages.join(', ') : 'none'}`);
  out.push('');
  return out;
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`msix-manifest-check: ${r.input.paths.join(', ')}`);
  out.push(`input: ${inputLine(r)}`);
  out.push(`root: ${rootLine(r)}`);
  out.push(`certificate subject: ${subjectLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Manifests (${grouped(r.manifests.length)})`, '');
  if (r.manifests.length) out.push(...table(['manifest', 'name', 'version', 'architecture', 'min build', 'max tested', 'error', 'warning', 'info'], r.manifests.map((m) => [cell(m.file, 80), m.read ? cell(m.name, 40) : 'not read', cell(m.version, 24), cell(m.architecture, 12), ...builds(m), grouped(m.byLevel.error), grouped(m.byLevel.warning), grouped(m.byLevel.info)])), '');
  else out.push('  none', '');
  if (r.manifests.length) {
    out.push('Summary', '');
    for (const m of r.manifests) out.push(...summaryLines(m));
  }
  out.push(`Rules (${grouped(r.rules.length)})`, '');
  out.push(...table(['rule', 'level', 'findings'], r.rules.map((x) => [x.id, x.level, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...r.config.rules.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.found}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      out.push(`${PAD}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

// The message of a workflow command: %, CR and LF escaped.
export const escapeData = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// A property of a workflow command: also : and , escaped.
export const escapeProperty = (t) => escapeData(t).replace(/:/g, '%3A').replace(/,/g, '%2C');

const COMMANDS = { error: 'error', warning: 'warning', info: 'notice' };

export function toGithub(r) {
  const out = [];
  for (const f of r.findings) {
    const props = [`file=${escapeProperty(f.file)}`, `line=${f.line}`, ...(f.column ? [`col=${f.column}`] : []), `title=${escapeProperty(`msix-manifest-check ${f.rule}`)}`];
    out.push(`::${COMMANDS[f.level]} ${props.join(',')}::${escapeData(`${f.found}; fix: ${f.fix}`)}`);
  }
  out.push(`msix-manifest-check: ${plural(r.totals.manifests, 'manifest')}, ${plural(r.totals.findings, 'finding')}; RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}
