// Shared test helpers: manifests and package folders built inline, read in memory or written into a temporary folder
// that is removed after the test. Paths are built with resolve() from forward-slash names, so the same test runs on
// Linux, macOS and Windows. The line a test expects is found with lineOf(), which counts lines the way the tool does,
// so a test never holds a line number worked out by hand for one system only. No test reads the clock, the time zone
// or the locale.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { defaultConfig, lineStarts, main, positionOf, readConfig, readManifest } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'msix-manifest-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function offsetOf(text, needle, n) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return at;
}

// The line (from 1) of the n-th place where needle starts in text.
export const lineOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).line;

// The column (from 1) of the n-th place where needle starts in text.
export const columnOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).column;

// The configuration of a configuration object, through the real reader, or the defaults.
export const configOf = (object = null) => (object === null ? defaultConfig() : readConfig(JSON.stringify(object), 'config.json'));

export const NS = {
  foundation: 'http://schemas.microsoft.com/appx/manifest/foundation/windows10',
  uap: 'http://schemas.microsoft.com/appx/manifest/uap/windows10',
  uap10: 'http://schemas.microsoft.com/appx/manifest/uap/windows10/10',
  rescap: 'http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities',
  desktop: 'http://schemas.microsoft.com/appx/manifest/desktop/windows10',
  com: 'http://schemas.microsoft.com/appx/manifest/com/windows10',
  uap3: 'http://schemas.microsoft.com/appx/manifest/uap/windows10/3'
};

export const SUBJECT = 'CN=Kestrel Works, O=Kestrel Works Ltd, C=NZ';

// A manifest in good order: a full-trust desktop app with a protocol and a file type, no capability and no extension
// that is listed. Every test of a rule changes one part of it.
export const GOOD = `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="${NS.foundation}" xmlns:uap="${NS.uap}" xmlns:rescap="${NS.rescap}" xmlns:desktop="${NS.desktop}" IgnorableNamespaces="uap rescap desktop">
  <Identity Name="Kestrel.Tally" Publisher="${SUBJECT}" Version="1.4.2.0" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>Kestrel Tally</DisplayName>
    <PublisherDisplayName>Kestrel Works</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
  </Resources>
  <Applications>
    <Application Id="Tally" Executable="Tally.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="Kestrel Tally" Description="Counts things" BackgroundColor="transparent" Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" />
      <Extensions>
        <uap:Extension Category="windows.protocol">
          <uap:Protocol Name="kestrel-tally" />
        </uap:Extension>
        <uap:Extension Category="windows.fileTypeAssociation">
          <uap:FileTypeAssociation Name="tally">
            <uap:SupportedFileTypes>
              <uap:FileType>.tally</uap:FileType>
            </uap:SupportedFileTypes>
          </uap:FileTypeAssociation>
        </uap:Extension>
      </Extensions>
    </Application>
  </Applications>
</Package>
`;

// The manifest with text replaced: pairs of [from, to], each replaced once.
export function goodWith(...pairs) {
  let out = GOOD;
  for (const [from, to] of pairs) {
    if (!out.includes(from)) throw new Error(`${from} is not in the manifest`);
    out = out.replace(from, to);
  }
  return out;
}

// One manifest read in memory: { summary, findings: [{ rule, line, column, found }], assets }.
export function manifestOf(text, { config = defaultConfig(), certSubject = null } = {}) {
  const starts = lineStarts(text);
  const r = readManifest(text, { config, certSubject, lineOf: (o) => positionOf(starts, o).line });
  return { ...r, findings: r.findings.map((f) => ({ rule: f.rule, ...positionOf(starts, f.offset), found: f.found })) };
}

// The rule ids of the findings of one manifest read in memory.
export const rulesOf = (text, options) => manifestOf(text, options).findings.map((f) => f.rule);

// The findings of one rule of a manifest read in memory.
export const ofRule = (text, rule, options) => manifestOf(text, options).findings.filter((f) => f.rule === rule);

const stand = (name) => `stand-in for ${name}\n`;

// A package folder in good order with its assets: the folder every test of a whole run changes.
export const PACKAGE = {
  'pkg/Package.appxmanifest': GOOD,
  'pkg/Assets/StoreLogo.scale-100.png': stand('StoreLogo'),
  'pkg/Assets/Square150x150Logo.scale-200.png': stand('Square150x150Logo'),
  'pkg/Assets/Square44x44Logo.targetsize-48_altform-unplated.png': stand('Square44x44Logo')
};

// The package with some files changed or added; null takes a file out.
export function packageWith(changes = {}) {
  const out = { ...PACKAGE };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = ['pkg/Package.appxmanifest', '--root', 'pkg'], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// The JSON report of a folder of files, with more arguments.
export async function reportOf(files, args = ['pkg/Package.appxmanifest', '--root', 'pkg']) {
  const r = await run(files, [...args, '--json']);
  if (r.code === 2) throw new Error(r.err);
  return { ...JSON.parse(r.out), code: r.code };
}

// The findings of a report, of one rule or of all.
export const findingsOf = (r, rule) => r.findings.filter((f) => !rule || f.rule === rule);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, dir) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
  return { code, out, err };
}
