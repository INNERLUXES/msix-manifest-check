import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_LIMITS, QUALIFIER_NAMES, assetPath, findAsset, isQualifierSet } from '../src/index.js';
import { PACKAGE, findingsOf, lineOf, packageWith, reportOf } from './helpers.js';

// The asset files a manifest names, looked for under --root: plain, with qualifiers in the name or in a folder, with the
// case ignored, and the paths the tool refuses to look for.

// A folder tree in memory, given as paths of files: the list() that findAsset() asks for.
function tree(paths, links = []) {
  return async (parts) => {
    const prefix = parts.length ? `${parts.join('/')}/` : '';
    const lowered = prefix.toLowerCase();
    const entries = new Map();
    for (const p of [...paths, ...links]) {
      if (!p.toLowerCase().startsWith(lowered) || p.length === prefix.length) continue;
      const rest = p.slice(prefix.length);
      const name = rest.split('/')[0];
      const type = links.includes(p) && !rest.includes('/') ? 'link' : rest.includes('/') ? 'folder' : 'file';
      if (!entries.has(name.toLowerCase())) entries.set(name.toLowerCase(), { name, type });
    }
    if (parts.length && !entries.size) return null;
    return { entries, limit: null };
  };
}

test('assets: the plain file, a file with qualifiers and a folder of qualifiers are found, with the case ignored', async () => {
  const list = tree(['Assets/Logo.png', 'Assets/Tile.scale-200.png', 'Assets/Icon.targetsize-48_altform-unplated.png', 'Assets/scale-400/Wide.png', 'Assets/contrast-high_scale-200/Splash.scale-100.png', 'Root.png']);
  assert.deepEqual(await findAsset('Assets\\Logo.png', list), { found: true, file: 'Assets/Logo.png' });
  assert.deepEqual(await findAsset('assets/LOGO.PNG', list), { found: true, file: 'Assets/Logo.png' });
  assert.deepEqual(await findAsset('Assets\\Tile.png', list), { found: true, file: 'Assets/Tile.scale-200.png' });
  assert.deepEqual(await findAsset('Assets\\Icon.png', list), { found: true, file: 'Assets/Icon.targetsize-48_altform-unplated.png' });
  assert.deepEqual(await findAsset('Assets/Wide.png', list), { found: true, file: 'Assets/scale-400/Wide.png' });
  assert.deepEqual(await findAsset('Assets/Splash.png', list), { found: true, file: 'Assets/contrast-high_scale-200/Splash.scale-100.png' });
  assert.deepEqual(await findAsset('./Root.png', list), { found: true, file: 'Root.png' });
});

test('assets: near misses are not found: another extension, a name that is not a qualifier, another folder', async () => {
  const list = tree(['Assets/Logo.jpg', 'Assets/Logo.old.png', 'Assets/Logo.scale-200.png.bak', 'Assets/old/Badge.png', 'Assets/Badge2.png', 'Images/Splash.png']);
  for (const p of ['Assets/Logo.png', 'Assets/Badge.png', 'Assets/Splash.png']) {
    const r = await findAsset(p, list);
    assert.equal(r.found, false, p);
    assert.match(r.reason, /Assets holds no .+, with or without qualifiers such as \.scale-200/);
  }
  assert.match((await findAsset('Missing/Logo.png', list)).reason, /there is no folder Missing under the root/);
  assert.match((await findAsset('Assets/Logo.jpg/x.png', list)).reason, /Assets\/Logo\.jpg is not a folder/);
});

test('assets: links are not followed, and paths that leave the root or are addresses are not looked for', async () => {
  const list = tree(['Assets/Other.png'], ['Assets/Logo.png', 'Linked']);
  assert.match((await findAsset('Assets/Logo.png', list)).reason, /Assets\/Logo\.png is a symbolic link, which is not followed/);
  assert.match((await findAsset('Linked/Logo.png', list)).reason, /Linked is a symbolic link/);
  for (const [p, reason] of [['', /empty/], ['ms-appx:///Assets/Logo.png', /an address or holds a drive letter/], ['C:\\Logo.png', /drive letter/], ['/Assets/Logo.png', /absolute/], ['\\Assets\\Logo.png', /absolute/], ['Assets/../../Logo.png', /leaves the root/], ['./.', /names no file/]]) {
    assert.match(assetPath(p).reason ?? '', reason, p);
    assert.equal((await findAsset(p, list)).found, false, p);
  }
  assert.deepEqual(assetPath(' Assets\\\\Logo.png ').parts, ['Assets', 'Logo.png']);
});

test('assets: qualifier sets and the limit of qualifier folders', async () => {
  for (const q of ['scale-100', 'SCALE-200', 'targetsize-16_altform-lightunplated', 'contrast-white', 'theme-dark', 'lang-en-us', 'language-de']) assert.ok(isQualifierSet(q), q);
  for (const q of ['old', 'scale', 'scale-', '-200', 'size-200', 'scale-200_', 'scale-2 00']) assert.ok(!isQualifierSet(q), q);
  assert.ok(QUALIFIER_NAMES.includes('targetsize'));
  const folders = Array.from({ length: 3 }, (_, i) => `Assets/scale-${100 + i}/x.txt`);
  const list = tree([...folders, 'Assets/scale-900/Logo.png']);
  assert.equal((await findAsset('Assets/Logo.png', list)).found, true);
  assert.equal((await findAsset('Assets/Logo.png', list, { maxQualifierFolders: 2 })).found, false);
  assert.equal(ASSET_LIMITS.maxQualifierFolders, 50);
});

test('assets: through a run, every logo the manifest names is looked for under --root, at the line of its path', async () => {
  const r = await reportOf(PACKAGE);
  assert.equal(r.code, 0);
  assert.deepEqual(findingsOf(r, 'missing-asset'), []);
  assert.match(r.notes.join('\n'), /3 asset paths looked for under pkg/);
  const gone = await reportOf(packageWith({ 'pkg/Assets/Square150x150Logo.scale-200.png': null }));
  const f = findingsOf(gone, 'missing-asset');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(PACKAGE['pkg/Package.appxmanifest'], 'Square150x150Logo="'));
  assert.match(f[0].found, /^the path "Assets\\Square150x150Logo\.png" \(the Square150x150Logo of the application "Tally"\) is not under the root pkg: Assets holds no Square150x150Logo\.png/);
  assert.equal(gone.code, 0, 'a missing asset is a warning');
  const none = await reportOf(packageWith({ 'pkg/Assets/Square150x150Logo.scale-200.png': null }), ['pkg/Package.appxmanifest']);
  assert.deepEqual(findingsOf(none, 'missing-asset'), [], 'without --root no asset is looked for');
  assert.match(none.notes.join('\n'), /--root is not given/);
});
