// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// packages to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The subjects of the signing certificates of the two made-up companies. The messy one is the subject of the
// certificate Brindlecote signs with, which its manifest does not match.
export const MESSY_SUBJECT = 'CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB';
export const CLEAN_SUBJECT = 'CN=Oakhollow Labs, O=Oakhollow Labs Ltd, L=Galway, C=IE';

// The arguments of the examples; every path is relative to the root of the repository.
export const MESSY = ['examples/messy/Package.appxmanifest', '--root', 'examples/messy', '--cert-subject', MESSY_SUBJECT, '--config', 'examples/config.json'];
export const CLEAN = ['examples/clean/Package.appxmanifest', '--root', 'examples/clean', '--cert-subject', CLEAN_SUBJECT];
const M = 'examples/messy/Package.appxmanifest';

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the messy package: the counts, the summary, one finding of every rule that fires, and the
// result.
export const EXPECTED = [
  'input: 0 folders and 1 file named; 1 manifest',
  'root: examples/messy; the asset files the manifests name are looked for under it',
  `certificate subject: ${MESSY_SUBJECT}`,
  'config: examples/config.json (Brindlecote release review): minimum build 10.0.17763.0',
  'findings: 20 (8 error, 6 warning, 6 info)',
  'Windows: Windows.Desktop MinVersion 10.0.22631.0 (build 22631), MaxVersionTested 10.0.19045.0 (build 19045)',
  'capabilities: restricted runFullTrust, broadFileSystemAccess; general internetClientServer, privateNetworkClientServer; device webcam, microphone, location; custom none',
  'the CN is "Brindlecote Software" in the manifest and "Brindlecote Software Ltd" in the certificate subject',
  'the Version "4.2.70000.0" is not four 16-bit numbers: 70000 is above 65535',
  'the MinVersion 10.0.22631.0 of Windows.Desktop is above its MaxVersionTested 10.0.19045.0',
  'the MinVersion 10.0.16299.0 of Windows.Universal (build 16299) is below the floor 10.0.17763.0 (build 17763)',
  'runFullTrust is a restricted capability',
  'broadFileSystemAccess is a restricted capability',
  'webcam is a device capability',
  'the path "Assets\\Square44x44Logo.png" (the Square44x44Logo of the application "App") is not under the root examples/messy',
  'the Id "App" is already used by the application at line 33',
  'has an Executable but no EntryPoint and no uap10:RuntimeBehavior',
  'the uap:VisualElements of the application "App" has no Description',
  'the protocol "ms-ledger" of the application "App" is reserved (ms-*)',
  'the file type association name "Ledger Book" of the application "App" is not valid: it is not all lowercase',
  'declares a startup task',
  'the Language "en_IE" is not a well-formed BCP 47 tag',
  'not a signature verification and not a Store certification',
  'RESULT: FAIL - 8 findings at or above error (8 error, 6 warning, 6 info)'
];
// What must not be reported: the logos found with their qualifiers, the language tag that is well formed, the
// restricted prefix of the manifest (the namespace is what counts), and the rules that have nothing to find.
export const UNWANTED = ['StoreLogo', 'Square150x150Logo.png" (', '"en-GB"', 'ERROR    unreadable-manifest', 'ERROR    missing-identity', 'ERROR    invalid-architecture', 'ERROR    invalid-publisher', 'RESULT: PASS'];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const messy = await run(MESSY);
  process.stdout.write(messy.out);
  expect('messy package', messy, 1, EXPECTED, UNWANTED);

  const clean = await run(CLEAN);
  expect('clean package', clean, 0, ['1 manifest', 'root: examples/clean', `certificate subject: ${CLEAN_SUBJECT}`, 'findings: 0', 'capabilities: restricted none; general none; device none; custom none', 'note: 5 asset paths looked for under examples/clean', 'RESULT: PASS - no finding at or above error'], ['  WARNING  ', '  ERROR  ', '  INFO  ', 'RESULT: FAIL']);

  // Without --root and --cert-subject, only the checks of the manifest itself run.
  expect('messy, manifest alone', await run(MESSY.slice(0, 1)), 1, ['root: not given', 'certificate subject: not given', 'INFO     general-capability', 'invalid-version'], ['WARNING  missing-asset', 'ERROR    publisher-mismatch']);
  // Only the errors are shown with --min-severity error.
  expect('messy, errors only', await run([...MESSY, '--min-severity', 'error']), 1, ['findings: 8 (8 error); 12 below error not shown', 'RESULT: FAIL - 8 findings at or above error'], ['WARNING  ', 'INFO  ']);
  // The clean package passes when every level fails the run.
  expect('clean, fail on info', await run([...CLEAN, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A --cert-subject that is not a distinguished name stops the run.
  expect('a subject that is not a name', await run([...CLEAN.slice(0, 3), '--cert-subject', 'Oakhollow Labs']), 2, ['--cert-subject "Oakhollow Labs" is not a distinguished name'], [], 'err');

  // The README shows the whole report of the messy package, the --explain lines of one finding, the GitHub annotations
  // of two findings, the start of the CSV report and the report of the clean package.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(messy.out)) problems.push('README: the sample output of the messy package differs from a real run');
  if (!readme.includes(clean.out)) problems.push('README: the sample output of the clean package differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/messy.txt'), messy.out);
  await writeFile(resolve(root, 'examples/output/clean.txt'), clean.out);
  const explain = await run([...MESSY, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('publisher-mismatch') && l.includes(`${M}:12`));
  const sample = lines.slice(at, at + 8).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of the publisher differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-explain.txt'), explain.out);
  const github = await run([...MESSY, '--format', 'github']);
  if (github.code !== 1) problems.push(`github: exit code ${github.code}, expected 1`);
  const picked = github.out.split('\n').filter((x) => x.includes('title=msix-manifest-check publisher-mismatch::') || x.includes('title=msix-manifest-check reserved-protocol::'));
  if (picked.length !== 2) problems.push('github: the sample lines are not in the output');
  for (const l of picked) if (!readme.includes(l)) problems.push('README: the GitHub sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-github.txt'), github.out);
  const csv = await run([...MESSY, '--format', 'csv']);
  if (csv.code !== 1) problems.push(`csv: exit code ${csv.code}, expected 1`);
  const head = csv.out.split('\r\n').slice(0, 4).join('\n');
  if (!readme.includes(head)) problems.push('README: the CSV sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-findings.csv'), csv.out);
  const json = await run([...MESSY, '--json', '--explain']);
  if (json.code !== 1) problems.push(`json: exit code ${json.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output/messy.json'), json.out);
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
