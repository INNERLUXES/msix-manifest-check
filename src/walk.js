// The listing of a folder: a folder of manifests named on the command line, or a folder of asset files under --root.
// Only the top of a folder is listed, never the folders inside it; a folder of manifests gives the files named
// Package.appxmanifest, AppxManifest.xml or *.appxmanifest. A symbolic link (a junction on Windows too) is counted and
// never followed, so the listing cannot leave the folder. The listing stops at its limit and says so, so a run never
// passes because a part of the folder was not read.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { asciiLower, byCode } from './words.js';

export const WALK_LIMITS = { maxEntries: 10000 };

// True for the name of a manifest file: AppxManifest.xml or a name ending with .appxmanifest, in any case.
export function isManifestName(name) {
  const lower = asciiLower(name);
  return lower === 'appxmanifest.xml' || (lower.endsWith('.appxmanifest') && lower.length > '.appxmanifest'.length);
}

// The manifests of a folder: { manifests: [{ name, full }], others, folders, links, limit }, in the order of the names.
export async function listFolder(full, { limits = WALK_LIMITS } = {}) {
  const lim = { ...WALK_LIMITS, ...limits };
  const list = await readdir(full, { withFileTypes: true });
  list.sort((a, b) => byCode(a.name, b.name));
  const manifests = [];
  let others = 0;
  let folders = 0;
  let links = 0;
  let limit = null;
  for (const [i, entry] of list.entries()) {
    if (i >= lim.maxEntries) {
      limit = `more than ${lim.maxEntries.toLocaleString('en-US')} files and folders`;
      break;
    }
    if (entry.isSymbolicLink()) links += 1;
    else if (entry.isDirectory()) folders += 1;
    else if (entry.isFile() && isManifestName(entry.name)) manifests.push({ name: entry.name, full: join(full, entry.name) });
    else others += 1;
  }
  return { manifests, others, folders, links, limit };
}

// The entries of a folder by their lowered name: { entries: Map of lowered name to { name, type } with type 'file',
// 'folder', 'link' or 'other', limit }. Names that differ only in case keep the first in the order of the names.
export async function listEntries(full, { limits = WALK_LIMITS } = {}) {
  const lim = { ...WALK_LIMITS, ...limits };
  const list = await readdir(full, { withFileTypes: true });
  list.sort((a, b) => byCode(a.name, b.name));
  const entries = new Map();
  let limit = null;
  for (const [i, entry] of list.entries()) {
    if (i >= lim.maxEntries) {
      limit = `more than ${lim.maxEntries.toLocaleString('en-US')} files and folders`;
      break;
    }
    const type = entry.isSymbolicLink() ? 'link' : entry.isDirectory() ? 'folder' : entry.isFile() ? 'file' : 'other';
    const key = asciiLower(entry.name);
    if (!entries.has(key)) entries.set(key, { name: entry.name, type });
  }
  return { entries, limit };
}
