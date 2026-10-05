// Command line: msix-manifest-check <manifest or folder>... [--root <folder>] [--cert-subject <subject>]
// [--config <file>] [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkPaths } from './check.js';
import { defaultsAsConfig } from './config.js';
import { toCsv } from './csv.js';
import { LEVELS } from './data.js';
import { toGithub, toJson, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, json: toJson, csv: toCsv, github: toGithub };

export const USAGE = `Usage: msix-manifest-check <manifest or folder>... [--root <folder>] [--cert-subject "<CN=...>"]
                           [--config <file>] [options]

Checks the package manifest of a Windows app packaged with MSIX (Package.appxmanifest or AppxManifest.xml) before a
Microsoft Store or sideload release, from the files alone. It reports an identity with a part missing, a version that
is not four 16-bit numbers, a processor architecture or publisher that is not valid, a publisher that is not the
subject of the signing certificate, device family versions that are missing, not valid or in the wrong order, a
MinVersion below the build floor, restricted capabilities that need a justification at Store submission, properties
and visual elements with a part missing, logo files that are not on disk, applications that cannot be started or share
an Id, protocol and file type names that are not valid or reserved, extensions worth a review, and languages that are
missing or not well formed. It reads elements by their namespace URI, never by their prefix. It fetches nothing, reads
no clock, follows no symbolic link and writes nothing to disk. A folder is read at its top only.

Options:
  --root <folder>           the root of the package; the logo and image paths of the manifest are looked for under it,
                            with or without qualifiers such as .scale-200
  --cert-subject <subject>  the subject of the signing certificate, such as "CN=Contoso, O=Contoso, C=US"; the
                            Publisher of the manifest must be exactly this text
  --config <file>           settings in strict JSON: rules, minBuildFloor, allowedRestrictedCapabilities,
                            reservedProtocols, minSeverity and failOn (--print-defaults shows them)
  --format <name>           text, json, csv or github (default: text); csv writes one row per finding, github writes
                            workflow commands that GitHub shows as annotations
  --json                    the same as --format json
  --min-severity <level>    the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: minSeverity of
                            the configuration, else info)
  --fail-on <level>         the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: failOn of
                            the configuration, else error)
  --explain                 show the rule, the public sources and the tool's own choice behind each finding
  --print-defaults          print the built-in configuration and exit
  --help                    show this text
  --version                 show the version

Rules: ${RULES.map((r) => `${r.id} (${r.key === null ? 'always error' : `rules.${r.key}`})`).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { paths: [], root: null, certSubject: null, config: null, format: null, json: false, minSeverity: null, failOn: null, explain: false, printDefaults: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--print-defaults') o.printDefaults = true;
    else if (a === '--root') o.root = once(a, o.root, next());
    else if (a === '--cert-subject') o.certSubject = once(a, o.certSubject, next());
    else if (a === '--config') o.config = once(a, o.config, next());
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length >= LIMITS.maxInputs) throw new Error(`more than ${LIMITS.maxInputs} files and folders named; name the folder that holds them`);
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!o.help && !o.version && !o.printDefaults) {
    if (!o.paths.length) throw new Error('give the manifest to check: a manifest file or the folder that holds it, such as msix-manifest-check Package.appxmanifest');
    for (const p of [...o.paths, o.root, o.config].filter((x) => x !== null)) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, json, csv or github)`);
    for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
    if (o.explain && (o.format === 'github' || o.format === 'csv')) throw new Error(`--explain adds the sources of each finding to the text and JSON reports; the ${o.format} format has no place for them`);
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`msix-manifest-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.printDefaults) {
    io.out(`${JSON.stringify(defaultsAsConfig(), null, 2)}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths({ paths: o.paths, root: o.root, certSubject: o.certSubject, config: o.config, minSeverity: o.minSeverity, failOn: o.failOn, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`msix-manifest-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`msix-manifest-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
