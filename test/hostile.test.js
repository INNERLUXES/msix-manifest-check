import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LIMITS, MAX_PROBLEMS, parseJson, parseXml } from '../src/index.js';
import { GOOD, NS, PACKAGE, cli, goodWith, packageWith, run, withFiles } from './helpers.js';

// Hostile input: manifests and folders built to exhaust the memory, the stack or the time, to make the tool expand an
// entity or follow a link out of the folder, to rewrite the terminal, to start a second workflow command, to slip a
// formula into a spreadsheet or to change how objects behave. Each heavy test also checks the time, because work that
// grows faster than the input is a failure even when the answer is right. Tests that need a symbolic link, a device or
// file permissions are guarded with process.platform, and none of them asserts a line: lines are asserted in the tests
// that run everywhere.

const M = 'pkg/Package.appxmanifest';
const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

test('hostile: a manifest of many capabilities and applications is read in one pass, and the limits of a manifest hold', LIMIT, async () => {
  const caps = `<Capabilities>${'<Capability Name="internetClient" />'.repeat(5000)}</Capabilities></Package>`;
  const r = await fast(() => run(packageWith({ [M]: goodWith(['</Package>', caps]) }), [M, '--json']));
  const out = JSON.parse(r.out);
  assert.equal(out.findings.length, LIMITS.maxFindingsPerRule);
  assert.equal(out.totals.notListed, LIMITS.maxCapabilities - LIMITS.maxFindingsPerRule);
  const app = GOOD.slice(GOOD.indexOf('    <Application '), GOOD.indexOf('</Application>') + '</Application>'.length);
  const apps = GOOD.replace('</Application>', `</Application>\n${Array.from({ length: 300 }, (_, i) => app.replace('Id="Tally"', `Id="T${i}"`)).join('\n')}`);
  const many = JSON.parse((await fast(() => run(packageWith({ [M]: apps }), [M, '--root', 'pkg', '--json'], { maxAssets: 50 }))).out);
  assert.equal(many.manifests[0].applications.length, LIMITS.maxApplications);
  assert.ok(many.findings.some((f) => f.rule === 'scan-limit' && /more than 50 asset files/.test(f.found)));
});

test('hostile: XML with many elements, open tags, quotes and references is read in one pass', LIMIT, async () => {
  const wide = `<a>${'<b x="1"/>'.repeat(19000)}</a>`;
  assert.equal((await fast(() => parseXml(wide))).children.length, 19000);
  await fast(() => assert.throws(() => parseXml(`<r>${'<a/>'.repeat(30000)}</r>`), /more than 20000 elements/));
  for (const text of ['<'.repeat(500000), `<a ${'b="'.repeat(100000)}`, '<!--'.repeat(100000), `<a${' x="1"'.repeat(300)}>`, `<a>${'&amp;'.repeat(200000)}</a>`, `<a>${'&'.repeat(200000)}</a>`, '<![CDATA['.repeat(100000), `${'<a>'.repeat(100000)}`, `<a ${'xmlns:p="u" '.repeat(200)}/>`, `<${'p:'.repeat(100000)}a/>`]) {
    await fast(() => {
      try {
        parseXml(text);
      } catch {
        // refused input is fine; the time is what is checked
      }
    });
  }
});

test('hostile: entity expansion and external entities are refused before anything is expanded or fetched', LIMIT, async () => {
  const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">${Array.from({ length: 9 }, (_, i) => `<!ENTITY lol${i + 1} "${`&lol${i || ''};`.repeat(10)}">`).join('')}]><Package xmlns="${NS.foundation}">&lol9;</Package>`;
  const r = await fast(() => run({ 'm.xml': laughs }, ['m.xml', '--json']));
  assert.match(JSON.parse(r.out).findings[0].found, /a DOCTYPE declaration; the tool refuses DTDs/);
  const external = await run({ 'm.xml': `<!DOCTYPE Package [<!ENTITY x SYSTEM "file:///etc/hostname">]><Package xmlns="${NS.foundation}">&x;</Package>` }, ['m.xml', '--json']);
  assert.match(JSON.parse(external.out).findings[0].found, /DOCTYPE/);
  const parameter = await run({ 'm.xml': `<Package xmlns="${NS.foundation}"><!ENTITY % p SYSTEM "http://a.test/x"></Package>` }, ['m.xml', '--json']);
  assert.match(JSON.parse(parameter.out).findings[0].found, /an ENTITY declaration/);
});

test('hostile: XML and JSON nested very deep are refused without exhausting the stack', LIMIT, async () => {
  assert.throws(() => parseJson(`${'['.repeat(100000)}${']'.repeat(100000)}`, { maxDepth: 32 }), /nested more than 32 deep/);
  const deep = `<Package xmlns="${NS.foundation}">${'<a>'.repeat(5000)}${'</a>'.repeat(5000)}</Package>`;
  const r = await fast(() => run({ 'm.xml': deep }, ['m.xml', '--json']));
  assert.match(JSON.parse(r.out).findings[0].found, /nested more than 64 deep/);
});

test('hostile: two hundred and more manifests in a folder are read in seconds, and the limits of a folder and of manifests hold', LIMIT, async () => {
  const files = {};
  for (let i = 0; i < LIMITS.maxManifests + 50; i += 1) files[`many/m${i}.appxmanifest`] = GOOD;
  const r = await fast(() => run(files, ['many', '--json']), 60000);
  const out = JSON.parse(r.out);
  assert.equal(out.input.manifests, LIMITS.maxManifests);
  assert.equal(out.findings.filter((f) => f.rule === 'scan-limit').length, 1);
  const entries = await run(files, ['many', '--json'], { maxEntries: 3 });
  assert.match(JSON.parse(entries.out).findings[0].found, /the folder holds more than 3 files and folders/);
  const assets = await run(PACKAGE, [M, '--root', 'pkg', '--json'], { maxEntries: 1 });
  assert.ok(JSON.parse(assets.out).findings.some((f) => f.rule === 'scan-limit' && f.file === 'pkg'));
});

test('hostile: a manifest over its size limit is an unreadable-manifest error, and a configuration over its limit stops the run', LIMIT, async () => {
  const big = await run({ 'm.xml': `<Package xmlns="${NS.foundation}"><!--${'x'.repeat(LIMITS.maxManifestBytes)}--></Package>` }, ['m.xml', '--json']);
  assert.match(JSON.parse(big.out).findings[0].found, /bytes is over the 2 MB limit/);
  const config = await run({ ...PACKAGE, 'c.json': ' '.repeat(LIMITS.maxConfigBytes + 1) }, [M, '--config', 'c.json']);
  assert.equal(config.code, 2);
  assert.match(config.err, /c\.json: [\d,]+ bytes is over the 1 MB limit/);
  const many = await run({ ...PACKAGE, 'c.json': JSON.stringify(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 1]))) }, [M, '--config', 'c.json']);
  assert.match(many.err, /\n {2}and 10 more\n$/);
  assert.equal(many.err.split('\n').filter((l) => l.startsWith('  c.json')).length, MAX_PROBLEMS);
});

test('hostile: long values and long paths are capped in the messages', LIMIT, async () => {
  const long = 'x'.repeat(200000);
  const r = await fast(() => run(packageWith({ [M]: goodWith(['Version="1.4.2.0"', `Version="${long}"`], ['Name="kestrel-tally"', `Name="${long}"`], ['Assets\\StoreLogo.png', `Assets\\${long}.png`]) }), [M, '--root', 'pkg', '--json']));
  const out = JSON.parse(r.out);
  assert.ok(out.findings.every((f) => f.found.length <= 800));
  assert.ok(out.findings.some((f) => f.rule === 'invalid-version'));
  assert.ok(out.findings.some((f) => f.rule === 'missing-asset'));
});

test('hostile: control, escape, direction and line separator characters in values are removed from every format', async () => {
  const evil = '1.0&#x1b;[31m&#x202e;&#x2028;x';
  const files = packageWith({ [M]: goodWith(['Version="1.4.2.0"', `Version="${evil}"`]) });
  for (const format of ['text', 'json', 'csv', 'github']) {
    const r = await run(files, [M, '--format', format]);
    assert.equal(r.code, 1);
    for (const c of ['\u001b', '\u202e', '\u2028']) assert.ok(!r.out.includes(c) && !JSON.stringify(JSON.parse(format === 'json' ? r.out : '{}')).includes(c), `${format}: ${JSON.stringify(c)}`);
  }
});

test('hostile: a value cannot end a workflow command or start another one, and a formula is neutralized in CSV', async () => {
  const files = packageWith({ [M]: goodWith(['Version="1.4.2.0"', 'Version="%0A::error file=x::y&#10;::warning::z"']) });
  const github = await run(files, [M, '--format', 'github']);
  const lines = github.out.trimEnd().split('\n');
  assert.ok(lines.slice(0, -1).every((l) => /^::(?:error|warning|notice) file=/.test(l)), github.out);
  assert.ok(github.out.includes('%250A::error file=x::y ::warning::z'));
  const csv = await run(packageWith({ [M]: goodWith(['Name="kestrel-tally"', 'Name="=cmd|calc"']) }), [M, '--format', 'csv', '--min-severity', 'error']);
  assert.ok(csv.out.split('\r\n').slice(1, -1).every((l) => !/,[=+@-]/.test(l.replace(/,"[^"]*"/g, ','))), csv.out);
});

test('hostile: __proto__, constructor and toString as names of applications, capabilities and protocols change nothing', async () => {
  const app = GOOD.slice(GOOD.indexOf('    <Application '), GOOD.indexOf('</Application>') + '</Application>'.length);
  const text = goodWith(['Id="Tally"', 'Id="__proto__"'], ['Name="kestrel-tally"', 'Name="constructor"'], ['</Package>', '<Capabilities><rescap:Capability Name="toString" /><Capability Name="__proto__" /></Capabilities></Package>']).replace('</Applications>', `${app.replace('Id="Tally"', 'Id="__proto__"').replace('Name="kestrel-tally"', 'Name="constructor"')}\n  </Applications>`);
  const r = await run({ 'm.xml': text, 'c.json': '{"allowedRestrictedCapabilities": ["toString"]}' }, ['m.xml', '--config', 'c.json', '--json']);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.findings.map((f) => f.rule).sort(), ['duplicate-application-id', 'general-capability', 'invalid-association']);
  assert.deepEqual(out.manifests[0].allowedRestricted, ['toString']);
  assert.equal({}.polluted, undefined);
});

test('hostile: CRLF, CR and a byte order mark give the same report as LF', async () => {
  const text = goodWith(['Version="1.4.2.0"', 'Version="1.4.2"'], ['<Logo>Assets\\StoreLogo.png</Logo>', '<Logo>Assets\\Gone.png</Logo>']);
  const lf = await run(packageWith({ [M]: text }), [M, '--root', 'pkg', '--json']);
  for (const [name, change] of [['CRLF', (t) => t.split('\n').join('\r\n')], ['CR', (t) => t.split('\n').join('\r')], ['BOM', (t) => `\ufeff${t}`]]) {
    const other = await run(packageWith({ [M]: change(text) }), [M, '--root', 'pkg', '--json']);
    assert.deepEqual(JSON.parse(other.out).findings, JSON.parse(lf.out).findings, name);
    assert.equal(other.code, 1, name);
  }
});

test('hostile: a symbolic link in a folder is counted and not followed, a link named is refused, and a linked asset is not read', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symbolic links need extra rights on Windows');
    return;
  }
  await withFiles(PACKAGE, async (dir) => {
    await mkdir(resolve(dir, 'outside'));
    await writeFile(resolve(dir, 'outside/AppxManifest.xml'), GOOD);
    await writeFile(resolve(dir, 'outside/Square44x44Logo.png'), 'x');
    await symlink(resolve(dir, 'outside/AppxManifest.xml'), resolve(dir, 'pkg/AppxManifest.xml'));
    await symlink(resolve(dir, 'outside'), resolve(dir, 'pkg/loop'));
    await symlink(resolve(dir, 'pkg'), resolve(dir, 'pkg-link'));
    const r = await cli(['pkg', '--json'], dir);
    const out = JSON.parse(r.out);
    assert.equal(out.input.links, 2);
    assert.equal(out.input.manifests, 1);
    assert.match(out.notes.join('\n'), /2 symbolic links are not followed/);
    const named = await cli(['pkg-link'], dir);
    assert.equal(named.code, 2);
    assert.match(named.err, /is a symbolic link, which is not followed/);
    const root = await cli([M, '--root', 'pkg-link'], dir);
    assert.equal(root.code, 2);
    await symlink(resolve(dir, 'outside/Square44x44Logo.png'), resolve(dir, 'pkg/Assets/Square44x44Logo.png'));
    await writeFile(resolve(dir, 'pkg/Assets/Square44x44Logo.targetsize-48_altform-unplated.png'), '');
    const linked = JSON.parse((await cli([M, '--root', 'pkg', '--json'], dir)).out);
    assert.deepEqual(linked.findings.map((f) => f.rule), [], 'the plain file with qualifiers is found, the link is passed over');
  });
});

test('hostile: a device named as a manifest is refused, and a manifest with no read access is an unreadable-manifest error', async (t) => {
  if (process.platform === 'win32') {
    t.skip('devices and file modes work differently on Windows');
    return;
  }
  const device = await cli(['/dev/zero'], process.cwd());
  assert.equal(device.code, 2);
  assert.match(device.err, /is not a regular file or folder/);
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('the root user reads every file whatever its mode');
    return;
  }
  await withFiles(PACKAGE, async (dir) => {
    await chmod(resolve(dir, M), 0o000);
    const r = await cli([M, '--json'], dir);
    assert.match(JSON.parse(r.out).findings.find((f) => f.rule === 'unreadable-manifest').found, /cannot be read \(EACCES\)/);
    await chmod(resolve(dir, M), 0o644);
  });
});
