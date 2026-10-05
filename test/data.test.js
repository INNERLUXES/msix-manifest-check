import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTICE, POINTS, RULES, SOURCES, pointPage, source } from '../src/index.js';
import { configOf } from './helpers.js';

// The public pages the checks rest on: every page of src/data.js is listed in research/sources.md and in
// docs/rules-and-sources.md, every rule names points that exist, and no point is a long quote.

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');

test('data: every page has an id, a title and an https address with no number that reads like a year, and every point names a page', () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  for (const s of SOURCES) {
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\//, s.id);
    assert.doesNotMatch(s.url, /(?:19|20)\d{2}/, s.id);
    assert.ok(s.title.length > 10, s.id);
  }
  for (const [key, p] of Object.entries(POINTS)) {
    assert.ok(source(p.source), `${key}: ${p.source}`);
    assert.equal(pointPage(key).id, p.source);
    assert.ok(p.text.length < 300, `${key} is short`);
    assert.ok(!/"[^"]{20,}"/.test(p.text), `${key} is written in this project's own words, with no long quotation`);
  }
  for (const s of SOURCES) assert.ok(Object.values(POINTS).some((p) => p.source === s.id), `${s.id} is used by a point`);
  for (const host of ['learn.microsoft.com', 'www.rfc-editor.org', 'community.owasp.org', 'cheatsheetseries.owasp.org', 'docs.github.com']) assert.ok(SOURCES.some((s) => s.url.startsWith(`https://${host}/`)), host);
  for (const page of ['appx-package-manifest', 'element-package', 'element-identity', 'element-properties', 'element-targetdevicefamily', 'element-application', 'element-uap-visualelements', 'element-capabilities', 'app-capability-declarations', 'msix/overview', 'create-certificate-package-signing', 'desktop-to-uwp-packaging-dot-net', 'element-uap-protocol', 'element-uap-filetypeassociation', 'info/bcp47', 'rfc4180', 'rfc8259', 'CSV_Injection', 'XML_External_Entity_Prevention', 'workflow-commands']) assert.ok(SOURCES.some((s) => s.url.includes(page)), page);
});

test('data: the points name what the checks lean on', () => {
  assert.match(POINTS.identityPublisher.text, /must match the publisher subject of the certificate/);
  assert.match(POINTS.certSubject.text, /must match the Publisher/);
  assert.match(POINTS.identityFields.text, /quad notation/);
  assert.match(POINTS.identityFields.text, /x86, x64, arm, arm64, x86a64 or neutral/);
  assert.match(POINTS.tdfFields.text, /MinVersion and MaxVersionTested/);
  assert.match(POINTS.restrictedApproval.text, /sideloading needs no approval/);
  assert.match(POINTS.capabilityGroups.text, /rescap namespace/);
  assert.match(POINTS.applicationFields.text, /cannot be used twice in one package/);
  assert.match(POINTS.visualElementsFields.text, /Square150x150Logo and Square44x44Logo/);
  assert.match(POINTS.qualifiedNames.text, /scale-200/);
  assert.match(POINTS.protocolLowercase.text, /all lowercase/);
  assert.match(POINTS.fileTypeName.text, /lowercase, with no spaces/);
  assert.match(POINTS.packageLanguage.text, /at least one language/);
  assert.match(POINTS.xxeDoctype.text, /refuse DOCTYPE/);
});

test('data: every rule names points that exist, the ids and keys are unique, and every rule says what to change', () => {
  for (const r of RULES) {
    assert.ok(r.basis.length > 0, r.id);
    for (const k of r.basis) assert.ok(POINTS[k], `${r.id}: ${k}`);
    assert.match(r.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof r.rule(configOf()), 'string');
    assert.equal(typeof r.rule(configOf({ reservedProtocols: [], allowedRestrictedCapabilities: ['runFullTrust'] })), 'string');
    assert.ok(r.own.length > 20, r.id);
    assert.ok(r.fix.length > 10, r.id);
    assert.ok(r.title.length > 10, r.id);
  }
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  assert.equal(new Set(RULES.filter((r) => r.key).map((r) => r.key)).size, RULES.filter((r) => r.key).length);
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const k of Object.keys(POINTS).filter((x) => !used.has(x))) assert.ok(['csvRecords', 'csvInjection', 'jsonUtf8', 'jsonRepeatedNames', 'githubAnnotations', 'signTool', 'packagedDesktop', 'bcp47Parts'].includes(k), `${k} is used by no rule`);
  assert.ok(NOTICE.startsWith('This check reads the manifest and the asset files beside it on disk and fetches nothing.'));
  assert.ok(NOTICE.includes('not a signature verification and not a Store certification'));
  assert.ok(NOTICE.includes('docs/limits.md'));
});

test('research/sources.md: lists every page with its address, in its own words', async () => {
  const note = await read('research/sources.md');
  for (const s of SOURCES) assert.ok(note.includes(s.url), s.url);
  assert.ok(note.includes('Each page was fetched and read before it was listed.'));
  const quotes = note.match(/"[^"]{60,}"/g) ?? [];
  assert.deepEqual(quotes, [], 'no long quotation');
  assert.ok(!note.includes('\r'));
});

test('docs/rules-and-sources.md: every rule with its points, its choice and its fix, and every page', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const r of RULES) {
    assert.ok(doc.includes(`### \`${r.id}\``), r.id);
    for (const k of r.basis) assert.ok(doc.includes(POINTS[k].text.slice(1)), `${r.id}: ${k}`);
    assert.ok(doc.includes(r.fix.slice(1)), `${r.id}: fix`);
    assert.ok(doc.includes(r.own.slice(1)), `${r.id}: own`);
  }
  for (const s of SOURCES) assert.ok(doc.includes(s.url), s.url);
  for (const [key, p] of Object.entries(POINTS)) assert.ok(doc.includes(`| \`${key}\` | ${pointPage(key).title} | ${p.text} |`), key);
});
