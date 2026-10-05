import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAN, CLEAN_SUBJECT, EXPECTED, MESSY, MESSY_SUBJECT, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const M = 'examples/messy/Package.appxmanifest';

test('examples: the messy package fails with the report that is saved in examples/output', async () => {
  const r = await run(MESSY);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('messy.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the clean package passes with the report that is saved', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('clean.txt'));
  assert.match(r.out, /\nfindings: 0\n/);
  assert.equal((await run([...CLEAN, '--fail-on', 'info'])).code, 0);
  assert.equal((await run([...CLEAN, '--config', 'examples/config.json', '--fail-on', 'info'])).code, 0, 'the clean package also meets the configuration of the messy one');
  assert.equal((await run([...CLEAN.slice(0, 3), '--cert-subject', MESSY_SUBJECT])).code, 1, 'and fails with the certificate of another company');
  assert.ok(CLEAN.includes(CLEAN_SUBJECT));
});

test('examples: --explain, JSON, CSV, the GitHub commands and the defaults are the reports that are saved', async () => {
  const outputs = { 'messy-explain.txt': [...MESSY, '--explain'], 'messy.json': [...MESSY, '--json', '--explain'], 'messy-findings.csv': [...MESSY, '--format', 'csv'], 'messy-github.txt': [...MESSY, '--format', 'github'], 'defaults.json': ['--print-defaults'] };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: the rules that fire on the messy package, each on the line built for it', async () => {
  const report = JSON.parse((await run([...MESSY, '--json'])).out);
  const lines = (await readFile(resolve(root, M), 'utf8')).split('\n');
  const at = (needle, n = 1) => `${M}:${lines.map((l, i) => [l, i]).filter(([l]) => l.includes(needle))[n - 1][1] + 1}`;
  const byRule = {};
  for (const x of report.findings) (byRule[x.rule] ??= []).push(x.at);
  assert.deepEqual(byRule, {
    'publisher-mismatch': [at('Publisher=')],
    'invalid-version': [at('Version="4.2.70000.0"')],
    'invalid-target-version': [at('MinVersion="10.0.22631.0"')],
    'reserved-protocol': [at('Name="ms-ledger"')],
    'invalid-association': [at('Name="Ledger Book"')],
    'invalid-application': [at('Id="App"', 2)],
    'duplicate-application-id': [at('Id="App"', 2)],
    'missing-visual-elements': [at('<uap:VisualElements', 2)],
    'min-version-below-floor': [at('MinVersion="10.0.16299.0"')],
    'invalid-language-tag': [at('Language="en_IE"')],
    'missing-asset': [at('Square44x44Logo=', 1), at('Square44x44Logo=', 2)],
    'restricted-capability': [at('runFullTrust'), at('broadFileSystemAccess')],
    'extension-listed': [at('windows.startupTask')],
    'general-capability': [at('internetClientServer'), at('privateNetworkClientServer'), at('webcam'), at('microphone'), at('location')]
  });
  const m = report.manifests[0];
  assert.deepEqual([m.name, m.version, m.architecture], ['Brindlecote.Ledger', '4.2.70000.0', 'x64']);
  assert.deepEqual(m.devices.map((d) => [d.name, d.minBuild, d.maxBuild]), [['Windows.Desktop', 22631, 19045], ['Windows.Universal', 16299, 22621]]);
  assert.deepEqual(m.capabilities, { restricted: ['runFullTrust', 'broadFileSystemAccess'], general: ['internetClientServer', 'privateNetworkClientServer'], device: ['webcam', 'microphone', 'location'], custom: [] });
});

test('examples: the messy manifest binds the restricted namespace to a prefix of its own, and the namespace is what counts', async () => {
  const text = await readFile(resolve(root, M), 'utf8');
  assert.match(text, /xmlns:restricted="http:\/\/schemas\.microsoft\.com\/appx\/manifest\/foundation\/windows10\/restrictedcapabilities"/);
  assert.ok(!text.includes('rescap:'));
  const report = JSON.parse((await run([...MESSY, '--json'])).out);
  assert.equal(report.findings.filter((f) => f.rule === 'restricted-capability').length, 2);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same output', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'msix-manifest-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const messy = resolve(dir, M);
    const text = (await readFile(messy, 'utf8')).split('\r\n').join('\n');
    await writeFile(messy, text.split('\n').join('\r\n'));
    await writeFile(resolve(dir, 'examples/clean/Package.appxmanifest'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from((await readFile(resolve(root, 'examples/clean/Package.appxmanifest'), 'utf8')).split('\n').join('\r\n'), 'utf16le')]));
    assert.equal((await run([...MESSY, '--explain'], dir)).out, await saved('messy-explain.txt'));
    assert.equal((await run(CLEAN, dir)).out, await saved('clean.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
