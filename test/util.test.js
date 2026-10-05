import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { DEVICE_NOTES, EXTENSION_NOTES, FILE_LIMITS, FOUNDATION, GENERAL_NOTES, GROUPS, MAX_PART, MAX_PUBLISHER_LENGTH, MAX_TAG_LENGTH, MAX_VERSION_LENGTH, NAMESPACES, OPEN_FLAGS, RESTRICTED_NOTES, RULES, WALK_LIMITS, asciiLower, atOrAbove, baseName, byCode, capabilityNote, capped, checkPaths, compareQuad, decide, defaultConfig, displayPath, dnDifference, familyOf, fileError, flat, folderOf, groupOf, grouped, inspectPath, isManifestName, joinPath, languageTagProblem, levelOf, listEntries, listFolder, listText, parseDn, parseQuad, plural, quadText, readBounded, readOne, readText, readTextFile, ruleById, safeText, textOf, usualPrefix } from '../src/index.js';
import { GOOD, PACKAGE, SUBJECT, withFiles } from './helpers.js';

test('versions: quad versions of four 16-bit parts, their order and the build', () => {
  assert.deepEqual(parseQuad('10.0.19041.0').parts, [10, 0, 19041, 0]);
  assert.deepEqual(parseQuad('65535.0.0.0').parts, [MAX_PART, 0, 0, 0]);
  for (const [v, reason] of [['', /empty/], ['1.2.3', /3 parts/], ['1', /1 part,/], ['1.2.3.65536', /above 65535/], ['1.2.3.123456', /above 65535/], ['1.2.03.4', /leading zero/], ['1.2.3.+4', /not a whole number/], ['1.2.3. 4', /not a whole number/], ['9'.repeat(MAX_VERSION_LENGTH + 1), /longer than/]]) assert.match(parseQuad(v).reason, reason, v);
  assert.ok(compareQuad([10, 0, 17763, 0], [10, 0, 19041, 0]) < 0);
  assert.ok(compareQuad([10, 0, 19041, 1], [10, 0, 19041, 0]) > 0);
  assert.equal(compareQuad([1, 2, 3, 4], [1, 2, 3, 4]), 0);
  assert.equal(quadText([10, 0, 22621, 0]), '10.0.22621.0');
});

test('publisher: distinguished names with quotes, escapes, plus signs and object identifiers, and why two differ', () => {
  assert.deepEqual(parseDn('CN=Kestrel Works, O="Kestrel, Ltd", C=NZ').parts.map((p) => [p.type, p.value]), [['CN', 'Kestrel Works'], ['O', 'Kestrel, Ltd'], ['C', 'NZ']]);
  assert.deepEqual(parseDn('CN=a\\,b + OU=c').parts.map((p) => p.value), ['a,b', 'c']);
  assert.equal(parseDn('2.5.4.3=Kestrel, cn=Tally').parts.length, 2);
  assert.equal(parseDn('CN=a').parts[0].offset, 0);
  assert.match(parseDn('').reason, /empty/);
  assert.match(parseDn('x'.repeat(MAX_PUBLISHER_LENGTH + 1)).reason, /longer than/);
  assert.match(parseDn('CN=a\\').reason, /backslash at the end/);
  assert.match(parseDn('CN="a" x').reason, /the character "x" after the value/);
  assert.match(parseDn('C.N=a').reason, /not a type/);
  assert.equal(dnDifference(SUBJECT, SUBJECT), null);
  assert.equal(dnDifference('CN=a', 'not a name'), 'the texts differ');
  assert.equal(dnDifference('CN=a, O=b', 'CN=a, O=b, '), 'the texts differ');
});

test('languages: well-formed BCP 47 tags and the reason a tag is not one', () => {
  for (const t of ['en', 'EN', 'fr-CA', 'zh-Hant-TW', 'es-419', 'zh-yue-HK', 'x-generate', 'en-GB-oed', 'qaa-Qaaa-QM-x-southern', 'sr-Latn-RS', 'en-US-u-ca-gregory']) assert.equal(languageTagProblem(t), null, t);
  for (const [t, reason] of [['', /empty/], ['en_US', /hyphen/], ['en US', /hyphen/], ['e', /two to eight letters/], ['1en', /two to eight letters/], ['en--US', /empty subtag/], ['-en', /empty subtag/], ['en-abcdefghi', /longer than eight/], ['x', /needs a subtag/], ['en-x', /needs a subtag/], ['en-a', /no subtag of two to eight/], ['en-US-Latn', /not in the place/], ['x'.repeat(MAX_TAG_LENGTH + 1), /longer than/]]) assert.match(languageTagProblem(t), reason, t);
});

test('namespaces: every URI of the table has a family and a prefix, the URI is compared as written', () => {
  assert.equal(familyOf(FOUNDATION), 'foundation');
  assert.equal(new Set(NAMESPACES.map((n) => n.uri)).size, NAMESPACES.length);
  for (const n of NAMESPACES) {
    assert.match(n.uri, /^http:\/\/schemas\.microsoft\.com\/appx\/manifest\//, n.uri);
    assert.ok(['foundation', 'uap', 'rescap', 'desktop', 'com', 'iot'].includes(n.family), n.uri);
    assert.equal(familyOf(n.uri), n.family);
  }
  assert.equal(familyOf(FOUNDATION.toUpperCase()), null);
  assert.equal(familyOf(`${FOUNDATION}/`), null);
  assert.equal(usualPrefix(`${FOUNDATION}/restrictedcapabilities`), 'rescap');
  assert.equal(usualPrefix('urn:x'), 'urn:x');
  for (const p of ['uap10', 'uap3', 'desktop4', 'rescap3', 'com']) assert.ok(NAMESPACES.some((n) => n.prefix === p), p);
});

test('capabilities: the group of an element by its family, and the notes', () => {
  assert.equal(groupOf('Capability', 'rescap'), 'restricted');
  assert.equal(groupOf('Capability', 'uap'), 'general');
  assert.equal(groupOf('Capability', 'foundation'), 'general');
  assert.equal(groupOf('Capability', 'desktop'), null);
  assert.equal(groupOf('DeviceCapability', 'foundation'), 'device');
  assert.equal(groupOf('DeviceCapability', 'uap'), null);
  assert.equal(groupOf('CustomCapability', 'uap'), 'custom');
  assert.equal(groupOf('Other', 'uap'), null);
  assert.deepEqual(GROUPS, ['restricted', 'general', 'device', 'custom']);
  for (const k of ['runFullTrust', 'broadFileSystemAccess', 'allowElevation', 'packageManagement', 'unvirtualizedResources']) assert.ok(RESTRICTED_NOTES[k], k);
  for (const k of ['internetClient', 'internetClientServer', 'privateNetworkClientServer']) assert.ok(GENERAL_NOTES[k], k);
  for (const k of ['webcam', 'microphone', 'location']) assert.ok(DEVICE_NOTES[k], k);
  for (const k of ['windows.startupTask', 'windows.fullTrustProcess', 'windows.appService', 'windows.comServer']) assert.ok(EXTENSION_NOTES[k], k);
  assert.equal(capabilityNote('custom', 'x'), '');
  assert.equal(capabilityNote('general', 'toString'), '');
  assert.equal(capabilityNote('restricted', '__proto__'), '');
});

test('words, sizes and text: ASCII lowercase, paths, lists, plurals and cleaned text', () => {
  assert.equal(asciiLower('Package.APPXMANIFEST'), 'package.appxmanifest');
  assert.equal(baseName('a/b/Package.appxmanifest'), 'Package.appxmanifest');
  assert.equal(folderOf('a/b/AppxManifest.xml'), 'a/b');
  assert.equal(folderOf('AppxManifest.xml'), '.');
  assert.equal(joinPath('.', 'a'), 'a');
  assert.equal(joinPath('a', ''), 'a');
  assert.equal(byCode('B', 'a'), -1);
  assert.equal(grouped(1234567), '1,234,567');
  assert.equal(listText(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(plural(1, 'manifest'), '1 manifest');
  assert.equal(safeText('a\u0007b\u202ec\u2028d', 100), 'a b c d');
  assert.equal(safeText('x'.repeat(20), 10), 'xxxxxxx...');
  assert.equal(flat(' a \n b '), 'a b');
});

test('rules: the levels, the result and the input problems', () => {
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.equal(ruleById('reserved-protocol').key, 'reservedProtocol');
  assert.equal(levelOf(ruleById('unreadable-manifest'), defaultConfig()), 'error');
  assert.deepEqual(decide([{ level: 'warning' }], 'error'), { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 0 }, text: 'PASS - no finding at or above error (1 warning)' });
  assert.equal(decide([{ level: 'error' }, { level: 'error' }], 'error').text, 'FAIL - 2 findings at or above error (2 error)');
  assert.equal(capped(Array.from({ length: 25 }, (_, i) => `p${i}`)).at(-1), 'and 5 more');
  assert.equal(RULES.filter((r) => r.key === null).length, 2);
});

test('files: bounded reading, UTF-8 and UTF-16 by the byte order mark, and paths as shown', async () => {
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<a/>', 'utf16le')]);
  const utf16be = Buffer.from(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('<a/>', 'utf16le')]).map((b, i, all) => (i < 2 ? b : all[i % 2 === 0 ? i + 1 : i - 1])));
  await withFiles({ 'a/x.xml': '<a/>\n', 'a/big.bin': Buffer.alloc(3000, 1), 'a/latin.xml': Buffer.from([0x61, 0xe9]), 'a/le.xml': utf16le }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a/x.xml'), 100)).toString(), '<a/>\n');
    await assert.rejects(readBounded(resolve(dir, 'a/big.bin'), 100), /3,000 bytes is over the 100 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'a'), 100), /is a folder/);
    await assert.rejects(readBounded(resolve(dir, 'none'), 100), /no such file/);
    assert.deepEqual(await readText(resolve(dir, 'a/le.xml'), 'a/le.xml', 100), { size: 10, text: '<a/>', encoding: 'utf-16le' });
    assert.equal(displayPath(resolve(dir, 'a/x.xml'), dir), 'a/x.xml');
    assert.equal(displayPath(dir, dir), '.');
    assert.ok(!displayPath(resolve(dir, '..', 'x'), dir).startsWith('..'));
    assert.equal((await inspectPath('a', dir)).folder, true);
    await assert.rejects(inspectPath('none', dir), /no such file or folder/);
    await assert.rejects(readTextFile('a', dir, 100), /is a folder; give the file itself/);
    const r = await readOne(resolve(dir, 'a/latin.xml'), 'a/latin.xml', { config: defaultConfig() });
    assert.equal(r.result, null);
    assert.match(r.findings[0].found, /not valid UTF-8/);
  });
  assert.deepEqual(textOf(Buffer.from('\ufeffx'), 'f'), { text: 'x', encoding: 'utf-8' });
  assert.deepEqual(textOf(utf16be, 'f'), { text: '<a/>', encoding: 'utf-16be' });
  assert.throws(() => textOf(Buffer.from([0xff]), 'f'), /not valid UTF-8/);
  assert.throws(() => textOf(Buffer.from('<a/>', 'utf16le'), 'f'), /a null byte\); a UTF-16 file needs its byte order mark/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x41]), 'f'), /odd number of bytes/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x00, 0xd8, 0x41, 0x00]), 'f'), /not valid UTF-16/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x00, 0x00]), 'f'), /a null character/);
  assert.equal(fileError('p', 'r').reason, 'r');
  assert.equal(typeof OPEN_FLAGS, 'number');
  assert.equal(FILE_LIMITS.maxManifestBytes, 2 * 1024 * 1024);
});

test('walk: the manifests at the top of a folder, and the entries of a folder by their lowered name', async () => {
  await withFiles({ 'r/Package.appxmanifest': 'x', 'r/AppxManifest.xml': 'x', 'r/Other.APPXMANIFEST': 'x', 'r/notes.txt': 'x', 'r/sub/AppxManifest.xml': 'x', 'a/Logo.PNG': 'x', 'a/scale-200/Logo.png': 'x' }, async (dir) => {
    const l = await listFolder(resolve(dir, 'r'));
    assert.deepEqual(l.manifests.map((m) => m.name), ['AppxManifest.xml', 'Other.APPXMANIFEST', 'Package.appxmanifest']);
    assert.deepEqual([l.others, l.folders, l.links, l.limit], [1, 1, 0, null]);
    const e = await listEntries(resolve(dir, 'a'));
    assert.deepEqual([...e.entries.entries()], [['logo.png', { name: 'Logo.PNG', type: 'file' }], ['scale-200', { name: 'scale-200', type: 'folder' }]]);
    assert.equal((await listEntries(resolve(dir, 'a'), { limits: { maxEntries: 1 } })).limit, 'more than 1 files and folders');
    assert.equal(WALK_LIMITS.maxEntries, 10000);
  });
  for (const [n, ok] of [['AppxManifest.xml', true], ['appxmanifest.XML', true], ['Package.appxmanifest', true], ['.appxmanifest', false], ['Package.appxmanifest.bak', false], ['manifest.xml', false]]) assert.equal(isManifestName(n), ok, n);
});

test('check: checkPaths builds the report of a run without the command line', async () => {
  await withFiles(PACKAGE, async (dir) => {
    const r = await checkPaths({ paths: ['pkg/Package.appxmanifest'], root: 'pkg', certSubject: SUBJECT, base: dir, version: '9.9.9' });
    assert.equal(r.version, '9.9.9');
    assert.equal(r.result.pass, true);
    assert.equal(r.input.manifests, 1);
    assert.equal(r.manifests[0].name, 'Kestrel.Tally');
    assert.equal(r.manifests[0].encoding, 'utf-8');
    assert.ok(GOOD.includes(r.manifests[0].publisher));
  });
});
