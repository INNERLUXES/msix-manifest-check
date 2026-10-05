import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CSV_COLUMNS, NOTICE, USAGE, VERSION, csvField, escapeData, escapeProperty, parseArgs } from '../src/index.js';
import { GOOD, PACKAGE, SUBJECT, cli, columnOf, goodWith, lineOf, packageWith, run, withFiles } from './helpers.js';

const M = 'pkg/Package.appxmanifest';
const WARN = packageWith({ 'pkg/Assets/StoreLogo.scale-100.png': null });
const ERROR = packageWith({ [M]: goodWith(['Version="1.4.2.0"', 'Version="1.4.2"']) });
const INFO = packageWith({ [M]: goodWith(['</Package>', '<Capabilities><Capability Name="internetClient" /></Capabilities></Package>']) });

test('cli: exit 0 below the fail-on level, 1 at or above it, from the flag or the configuration', async () => {
  const clean = await run(PACKAGE, [M, '--root', 'pkg', '--cert-subject', SUBJECT]);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /^msix-manifest-check: pkg\/Package\.appxmanifest\ninput: 0 folders and 1 file named; 1 manifest; 0 other files passed over; 0 folders inside passed over; 0 links not followed\nroot: pkg; the asset files the manifests name are looked for under it\ncertificate subject: CN=Kestrel Works, O=Kestrel Works Ltd, C=NZ\nconfig: built-in defaults: minimum build 10\.0\.17763\.0; restricted capabilities allowed none; reserved protocols http, https, file, ftp, mailto, microsoft-edge and ms-\*; minimum severity info; fail on error\nrules: missing-identity \(error\); /);
  assert.match(clean.out, /\nfindings: 0\n/);
  assert.match(clean.out, /RESULT: PASS - no finding at or above error\n$/);
  assert.equal(clean.err, '');
  assert.equal((await run(WARN)).code, 0, 'a warning does not fail the run by default');
  assert.equal((await run(WARN, [M, '--root', 'pkg', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(INFO, [M, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run(INFO, [M, '--fail-on', 'info'])).code, 1);
  const configured = await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [M, '--root', 'pkg', '--config', 'c.json']);
  assert.equal(configured.code, 1);
  assert.match(configured.out, /RESULT: FAIL - 1 finding at or above warning \(1 warning\)\n$/);
  assert.equal((await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [M, '--root', 'pkg', '--config', 'c.json', '--fail-on', 'error'])).code, 0, 'the flag wins over the configuration');
  const error = await run(ERROR, [M]);
  assert.equal(error.code, 1);
  assert.match(error.out, /RESULT: FAIL - 1 finding at or above error \(1 error\)\n$/);
});

test('cli: a folder gives its manifests at its top, and a file is read whatever its name', async () => {
  const files = { 'a/AppxManifest.xml': GOOD, 'a/Package.appxmanifest': GOOD, 'a/notes.txt': 'x', 'a/sub/AppxManifest.xml': GOOD, 'b/manifest.copy': GOOD };
  const r = JSON.parse((await run(files, ['a', 'b/manifest.copy', '--json'])).out);
  assert.deepEqual(r.manifests.map((m) => m.file), ['a/AppxManifest.xml', 'a/Package.appxmanifest', 'b/manifest.copy']);
  assert.deepEqual([r.input.folders, r.input.files, r.input.otherFiles, r.input.foldersPassedOver], [1, 1, 1, 1]);
  const both = JSON.parse((await run(files, ['a/AppxManifest.xml', 'a', '--json'])).out);
  assert.equal(both.input.manifests, 2, 'a file named and found again in its folder is read once');
  const twice = await run(files, ['a', 'a/']);
  assert.equal(twice.code, 2);
  assert.match(twice.err, /a: is named twice/);
});

test('cli: a manifest that cannot be read is an unreadable-manifest error at its place, and the run goes on', async () => {
  const bad = GOOD.replace('<Properties>', '<Properties>\n    <!DOCTYPE x>');
  const r = await run({ 'a/AppxManifest.xml': bad, 'b/AppxManifest.xml': GOOD }, ['a', 'b', '--json']);
  assert.equal(r.code, 1);
  const out = JSON.parse(r.out);
  const f = out.findings.filter((x) => x.rule === 'unreadable-manifest');
  assert.deepEqual(f.map((x) => [x.file, x.line, x.column]), [['a/AppxManifest.xml', lineOf(bad, '<!DOCTYPE'), columnOf(bad, '<!DOCTYPE')]]);
  assert.match(f[0].found, /cannot be read as a package manifest: a DOCTYPE declaration/);
  assert.equal(out.manifests[0].read, false);
  assert.equal(out.manifests[1].read, true);
  assert.match((await run({ 'a/AppxManifest.xml': bad }, ['a'])).out, /a\/AppxManifest\.xml {2}not read/);
  const binary = await run({ 'm.xml': Buffer.from([0x3c, 0, 0x3e]) }, ['m.xml', '--json']);
  assert.match(JSON.parse(binary.out).findings[0].found, /holds binary data/);
  const latin = await run({ 'm.xml': Buffer.from([0x3c, 0x61, 0xe9, 0x2f, 0x3e]) }, ['m.xml', '--json']);
  assert.match(JSON.parse(latin.out).findings[0].found, /not valid UTF-8/);
  const notManifest = await run({ 'm.xml': '<rss version="2.0"/>' }, ['m.xml', '--json']);
  assert.match(JSON.parse(notManifest.out).findings[0].found, /the root element is <rss> with no namespace/);
  const off = await run({ 'm.xml': bad, 'c.json': '{"rules": {"unreadableManifest": "off"}}' }, ['m.xml', '--config', 'c.json']);
  assert.equal(off.code, 2, 'the rule of input problems has no key');
});

test('cli: a manifest saved as UTF-16 with its byte order mark, or with CRLF line ends, gives the same findings', async () => {
  const text = goodWith(['Version="1.4.2.0"', 'Version="1.4.2"']);
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const be = Buffer.from(le.map((b, i, all) => (i < 2 ? [0xfe, 0xff][i] : all[i % 2 === 0 ? i + 1 : i - 1])));
  const base = JSON.parse((await run({ 'm.xml': text }, ['m.xml', '--json'])).out);
  for (const content of [le, be, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]), text.split('\n').join('\r\n')]) {
    const r = JSON.parse((await run({ 'm.xml': content }, ['m.xml', '--json'])).out);
    assert.deepEqual(r.findings, base.findings);
  }
  assert.equal(JSON.parse((await run({ 'm.xml': le }, ['m.xml', '--json'])).out).manifests[0].encoding, 'utf-16le');
});

test('cli: --min-severity hides the findings below it and says so', async () => {
  const r = await run(INFO, [M, '--min-severity', 'warning']);
  assert.equal(r.code, 0);
  assert.match(r.out, /findings: 0; 1 below warning not shown/);
  assert.match(r.out, /note: 1 finding below warning is not shown/);
});

test('cli: --root and --cert-subject must be usable, or the run stops with no result', async () => {
  const notFolder = await run(PACKAGE, [M, '--root', M]);
  assert.equal(notFolder.code, 2);
  assert.match(notFolder.err, /--root pkg\/Package\.appxmanifest: is a file; give the folder the asset paths of the manifest start from/);
  assert.match((await run(PACKAGE, [M, '--root', 'nowhere'])).err, /--root nowhere: no such file or folder/);
  const subject = await run(PACKAGE, [M, '--cert-subject', 'Kestrel Works']);
  assert.equal(subject.code, 2);
  assert.match(subject.err, /--cert-subject "Kestrel Works" is not a distinguished name: the type Kestrel has no = after it/);
  assert.match((await run(PACKAGE, ['nothing.xml'])).err, /nothing\.xml: no such file or folder/);
});

test('cli: usage errors give exit code 2 and the usage', async () => {
  for (const argv of [[], ['--format', 'xml', 'm'], ['--min-severity', 'fatal', 'm'], ['--fail-on'], ['m', '--bogus'], ['m', '--root', 'a', '--root', 'b'], ['m', '--explain', '--format', 'csv'], ['m', '--json', '--format', 'csv'], ['-'], ['m', '--root', '-'], ['https://example.test/AppxManifest.xml'], ['m', '--root', 'https://a.test/d'], ['m', '--cert-subject', '--json']]) {
    const r = await cli(argv, process.cwd());
    assert.equal(r.code, 2, argv.join(' '));
    assert.equal(r.out, '');
    assert.match(r.err, /^msix-manifest-check: .+\n\nUsage: msix-manifest-check/, argv.join(' '));
  }
  assert.match((await cli(['https://example.test/AppxManifest.xml'], process.cwd())).err, /never fetches a URL/);
  assert.throws(() => parseArgs(Array.from({ length: 101 }, (_, i) => `f${i}`)), /more than 100 files and folders/);
  assert.equal(parseArgs(['a', 'b']).paths.length, 2);
  assert.equal(parseArgs(['a', '--cert-subject', 'CN=a, O=b']).certSubject, 'CN=a, O=b');
});

test('cli: --help, --version and --print-defaults', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const s of ['--root', '--cert-subject', '--config', '--format', '--json', '--min-severity', '--fail-on', '--explain', '--print-defaults', 'Exit codes: 0', 'publisher-mismatch (rules.publisherMismatch)', 'unreadable-manifest (always error)']) assert.ok(USAGE.includes(s), s);
  assert.equal((await cli(['-v'], process.cwd())).out, `${VERSION}\n`);
  const d = await cli(['--print-defaults'], process.cwd());
  assert.equal(JSON.parse(d.out).name, 'built-in defaults');
  assert.equal(JSON.parse(d.out).minBuildFloor, '10.0.17763.0');
});

test('report: the JSON report holds the input, the configuration, the manifests, the rules, the findings, the totals and the result', async () => {
  const r = await run(ERROR, [M, '--json']);
  const out = JSON.parse(r.out);
  assert.deepEqual(Object.keys(out), ['tool', 'version', 'input', 'config', 'manifests', 'rules', 'findings', 'totals', 'result', 'notes', 'notice']);
  assert.equal(out.tool, 'msix-manifest-check');
  assert.equal(out.notice, NOTICE);
  const f = out.findings[0];
  assert.deepEqual(Object.keys(f), ['rule', 'level', 'file', 'line', 'column', 'at', 'found', 'fix']);
  assert.equal(f.at, `${M}:${f.line}`);
  assert.equal(out.rules.length, 22);
  assert.deepEqual(Object.keys(out.manifests[0]), ['file', 'read', 'encoding', 'name', 'publisher', 'displayName', 'version', 'architecture', 'devices', 'capabilities', 'allowedRestricted', 'applications', 'extensions', 'languages', 'findings', 'byLevel']);
  const explained = JSON.parse((await run(ERROR, [M, '--json', '--explain'])).out);
  assert.ok(explained.findings[0].basis.length > 0);
  assert.ok(explained.findings[0].own.length > 0);
});

test('report: --explain adds the rule, the points of the public pages and the own choice to the text', async () => {
  const r = await run(ERROR, [M, '--explain']);
  assert.match(r.out, /\n {11}rule: an Identity Version that is not major\.minor\.build\.revision with each part from 0 to 65535\n {11}basis: Name, Publisher and Version are required;.+\(Identity \(manifest schema, Microsoft Learn\), https:\/\/learn\.microsoft\.com\/en-us\/uwp\/schemas\/appxpackage\/uapmanifestschema\/element-identity\)\n/);
  assert.match(r.out, /\n {11}the tool's own choice: /);
});

test('report: CSV with one record per finding, CRLF line ends, quotes and a neutralized formula', async () => {
  const r = await run(packageWith({ [M]: goodWith(['Version="1.4.2.0"', 'Version="=1+2"']) }), [M, '--format', 'csv']);
  assert.equal(r.code, 1);
  const lines = r.out.split('\r\n');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.equal(lines.at(-1), '');
  assert.equal(lines.length, 3);
  assert.match(lines[1], new RegExp(`^error,invalid-version,pkg/Package\\.appxmanifest,${lineOf(GOOD, 'Version=')},${columnOf(GOOD, '1.4.2.0')},"the Version ""=1\\+2"" is not four 16-bit numbers`));
  assert.equal(csvField('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvField('-1'), "'-1");
  assert.equal(csvField('@x'), "'@x");
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('a"b'), '"a""b"');
  assert.equal(csvField(null), '');
});

test('report: GitHub commands with file, line, column and title, escaped, and a summary line', async () => {
  const r = await run(ERROR, [M, '--format', 'github']);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], new RegExp(`^::error file=pkg/Package\\.appxmanifest,line=${lineOf(GOOD, 'Version=')},col=${columnOf(GOOD, '1.4.2.0')},title=msix-manifest-check invalid-version::the Version "1\\.4\\.2" is not four 16-bit numbers`));
  assert.equal(lines.at(-1), 'msix-manifest-check: 1 manifest, 1 finding; RESULT: FAIL - 1 finding at or above error (1 error)');
  assert.equal(escapeData('50%\r\nx'), '50%25%0D%0Ax');
  assert.equal(escapeProperty('a:b,c'), 'a%3Ab%2Cc');
  const info = await run(INFO, [M, '--format', 'github']);
  assert.match(info.out, /^::notice file=pkg\/Package\.appxmanifest,line=\d+,col=\d+,title=msix-manifest-check general-capability::/);
});

test('report: the text names each manifest with its identity, builds and counts, a summary, and ends with the notice and the result', async () => {
  const r = await run(WARN, [M, '--root', 'pkg']);
  assert.ok(r.out.includes('\n  pkg/Package.appxmanifest  Kestrel.Tally  1.4.2.0  x64           19041      22621       0      1        0\n'), r.out);
  assert.ok(r.out.includes('\n    Windows: Windows.Desktop MinVersion 10.0.19041.0 (build 19041), MaxVersionTested 10.0.22621.0 (build 22621)\n'));
  assert.ok(r.out.includes('\n    capabilities: restricted none; general none; device none; custom none\n'));
  assert.ok(r.out.includes('\n    applications: Tally (Tally.exe)\n'));
  assert.ok(r.out.includes(`\n${NOTICE}\n\nRESULT: PASS - no finding at or above error (1 warning)\n`));
  const allowed = await run(packageWith({ [M]: goodWith(['</Package>', '<Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities></Package>']), 'c.json': '{"allowedRestrictedCapabilities": ["runFullTrust"]}' }), [M, '--config', 'c.json']);
  assert.ok(allowed.out.includes('\n    allowed by the configuration: runFullTrust\n'));
  const empty = await withFiles({ 'e/readme.txt': 'x', 'e/sub/AppxManifest.xml': GOOD }, (dir) => cli(['e'], dir));
  assert.equal(empty.code, 0);
  assert.match(empty.out, /0 manifests; 1 other file passed over; 1 folder inside passed over/);
  assert.match(empty.out, /\nManifests \(0\)\n\n {2}none\n/);
  assert.match(empty.out, /note: the input holds no package manifest/);
});

test('cli: a run writes nothing to the folders it reads', async () => {
  await withFiles(PACKAGE, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    const r = await cli([M, '--root', 'pkg', '--cert-subject', 'CN=Other', '--format', 'csv'], dir);
    assert.equal(r.code, 1, 'the publisher is not the subject');
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
    assert.ok(resolve(dir).length > 0);
  });
});
