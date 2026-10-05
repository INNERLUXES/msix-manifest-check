// The asset files a manifest names: its logos and images, looked for under the package root given with --root. A path
// in a manifest uses backslashes or slashes and is relative to the root of the package. Windows compares file names
// without case and lets an image carry qualifiers, in its name (Logo.scale-200.png, Logo.targetsize-48_altform-
// unplated.png) or in the name of the folder that holds it (scale-200/Logo.png); the manifest names the file without
// them. So a path counts as found when the folder holds the plain file, a file with qualifiers, or a folder of
// qualifiers that holds either. The folders are listed with src/walk.js, and no link is followed.

import { asciiLower } from './words.js';

export const ASSET_LIMITS = { maxQualifierFolders: 50 };

// The qualifier names of the resource system.
export const QUALIFIER_NAMES = ['scale', 'targetsize', 'altform', 'alternateform', 'contrast', 'theme', 'lang', 'language', 'layoutdir', 'layoutdirection', 'dxfeaturelevel', 'devicefamily', 'homeregion', 'configuration', 'custom'];

// True when a text is a set of qualifiers such as scale-200 or contrast-high_scale-400.
export function isQualifierSet(text) {
  const tokens = asciiLower(text).split('_');
  return tokens.every((t) => {
    const at = t.indexOf('-');
    if (at <= 0 || at === t.length - 1) return false;
    const value = t.slice(at + 1);
    return QUALIFIER_NAMES.includes(t.slice(0, at)) && [...value].every((c) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-' || c === '.');
  });
}

// The parts of a path of the manifest: { parts } with the folders and the file name, or { reason } when the path is not
// one the tool looks for: empty, an address, absolute, or leaving the root.
export function assetPath(path) {
  const p = String(path).trim().split('\\').join('/');
  if (p === '') return { reason: 'the path is empty' };
  if (p.includes(':')) return { reason: 'the path is an address or holds a drive letter, not a path inside the package' };
  if (p.startsWith('/')) return { reason: 'the path is absolute, not a path inside the package' };
  const parts = p.split('/').filter((s) => s !== '' && s !== '.');
  if (parts.includes('..')) return { reason: 'the path leaves the root of the package with ..' };
  if (!parts.length) return { reason: 'the path names no file' };
  return { parts };
}

// True when a file name is the plain name or the name with qualifiers between its stem and its extension.
function matches(entryName, fileName) {
  const e = asciiLower(entryName);
  const f = asciiLower(fileName);
  if (e === f) return true;
  const dot = f.lastIndexOf('.');
  if (dot <= 0) return false;
  const stem = f.slice(0, dot);
  const ext = f.slice(dot);
  if (!e.startsWith(`${stem}.`) || !e.endsWith(ext) || e.length <= stem.length + 1 + ext.length) return false;
  return isQualifierSet(e.slice(stem.length + 1, e.length - ext.length));
}

// Looks for an asset path. list(parts) gives the entries of the folder at those parts under the root, as listEntries()
// of src/walk.js does, or null when there is no such folder. Returns { found: true, file } with the name found, or
// { found: false, reason }.
export async function findAsset(path, list, limits = ASSET_LIMITS) {
  const lim = { ...ASSET_LIMITS, ...limits };
  const p = assetPath(path);
  if (!p.parts) return { found: false, reason: p.reason };
  const written = p.parts.slice(0, -1);
  const file = p.parts.at(-1);
  // The folders with the names they have on disk, which may differ in case from the manifest.
  const folders = [];
  for (let i = 0; i < written.length; i += 1) {
    const listed = await list(folders);
    const entry = listed ? listed.entries.get(asciiLower(written[i])) : undefined;
    if (!entry) return { found: false, reason: `there is no folder ${written.slice(0, i + 1).join('/')} under the root` };
    if (entry.type === 'link') return { found: false, reason: `${written.slice(0, i + 1).join('/')} is a symbolic link, which is not followed` };
    if (entry.type !== 'folder') return { found: false, reason: `${written.slice(0, i + 1).join('/')} is not a folder` };
    folders.push(entry.name);
  }
  const where = folders.length ? folders.join('/') : 'the root';
  const listed = await list(folders);
  if (!listed) return { found: false, reason: `there is no folder ${where} under the root` };
  let link = null;
  for (const entry of listed.entries.values()) {
    if (!matches(entry.name, file)) continue;
    if (entry.type === 'file') return { found: true, file: [...folders, entry.name].join('/') };
    if (entry.type === 'link') link = entry.name;
  }
  let looked = 0;
  for (const entry of listed.entries.values()) {
    if (entry.type !== 'folder' || !isQualifierSet(entry.name)) continue;
    looked += 1;
    if (looked > lim.maxQualifierFolders) break;
    const inner = await list([...folders, entry.name]);
    for (const e of inner ? inner.entries.values() : []) {
      if (e.type === 'file' && matches(e.name, file)) return { found: true, file: [...folders, entry.name, e.name].join('/') };
    }
  }
  if (link) return { found: false, reason: `${[...folders, link].join('/')} is a symbolic link, which is not followed` };
  return { found: false, reason: `${where} holds no ${file}, with or without qualifiers such as .scale-200` };
}
