// The checks of one package manifest. The text is read with the XML reader of src/xml.js; every element is then found
// by its local name and the family of its namespace URI (src/namespaces.js), never by its prefix. The checks give
// findings with the offset of the element, attribute or text they point at, the logo paths to look for on disk
// (src/assets.js does that), and a summary of the package: its identity, its version, the Windows builds it targets and
// its capabilities by group.

import { GROUPS, EXTENSION_NOTES, capabilityNote, groupOf } from './capabilities.js';
import { languageTagProblem } from './languages.js';
import { FOUNDATION, familyOf } from './namespaces.js';
import { dnDifference, parseDn } from './publisher.js';
import { grouped, listText } from './size.js';
import { asciiLower } from './words.js';
import { compareQuad, parseQuad, quadText } from './versions.js';
import { attrOf, childOf, childrenOf, parseXml } from './xml.js';

export const MANIFEST_LIMITS = { maxApplications: 100, maxCapabilities: 1000, maxAssets: 500 };

export class ManifestError extends Error {
  constructor(reason, offset) {
    super(reason);
    this.reason = reason;
    this.offset = offset;
  }
}

// The longest protocol name the schema takes.
export const MAX_PROTOCOL_LENGTH = 2 * 1024;

export const ARCHITECTURES = ['x86', 'x64', 'arm', 'arm64', 'x86a64', 'neutral'];
const VISUAL_REQUIRED = ['DisplayName', 'Description', 'BackgroundColor', 'Square150x150Logo', 'Square44x44Logo'];
const RUNTIME_WITHOUT_ENTRYPOINT = ['packagedClassicApp', 'win32App'];

const inFamily = (...families) => (uri) => families.includes(familyOf(uri));
const foundation = inFamily('foundation');
const foundationOrUap = inFamily('foundation', 'uap');
const anyFamily = (uri) => familyOf(uri) !== null;

// A protocol name in the form of a URI scheme, in lowercase: a letter, then letters, digits, +, - and ., 2 to 2,048
// characters.
export function protocolNameProblem(name) {
  if (name.length < 2 || name.length > MAX_PROTOCOL_LENGTH) return `it has ${grouped(name.length)} character${name.length === 1 ? '' : 's'}, not 2 to ${grouped(MAX_PROTOCOL_LENGTH)}`;
  if (name !== asciiLower(name)) return 'it is not all lowercase';
  if (!(name[0] >= 'a' && name[0] <= 'z')) return 'it does not start with a letter';
  const bad = [...name].find((c) => !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '-' || c === '.'));
  if (bad !== undefined) return `the character "${bad}" is not one of a URI scheme (letters, digits, +, - and .)`;
  return null;
}

// True when a protocol name is in the list of reserved names, where an entry that ends with * is a prefix.
export function isReserved(name, reserved) {
  const lower = asciiLower(name);
  return reserved.find((r) => (r.endsWith('*') ? lower.startsWith(r.slice(0, -1)) : lower === r)) ?? null;
}

// A file type association name: 1 to 64 lowercase characters with no space.
export function fileTypeNameProblem(name) {
  if (name.length < 1 || name.length > 64) return `it has ${name.length} characters, not 1 to 64`;
  if (name !== asciiLower(name)) return 'it is not all lowercase';
  if (/\s/.test(name)) return 'it holds a space';
  return null;
}

// Reads the text of a manifest and checks it. options: { config, certSubject, lineOf } where lineOf(offset) gives the
// line of an offset for a message that names another place. Returns { summary, findings: [{ rule, offset, found }],
// assets: [{ path, offset, what }] }; throws XmlError or ManifestError when the text cannot be read as a manifest.
export function readManifest(text, { config, certSubject = null, lineOf = () => 1, limits = MANIFEST_LIMITS } = {}) {
  const lim = { ...MANIFEST_LIMITS, ...limits };
  const root = parseXml(text);
  if (root.local !== 'Package' || root.uri !== FOUNDATION) {
    throw new ManifestError(`the root element is <${root.name.slice(0, 40)}>${root.uri ? ` of the namespace ${root.uri.slice(0, 80)}` : ' with no namespace'}, not Package of the foundation namespace ${FOUNDATION}`, root.offset);
  }
  const findings = [];
  const assets = [];
  const add = (rule, offset, found) => findings.push({ rule, offset, found });
  const attrText = (el, name, uri = '') => {
    const a = attrOf(el, name, uri);
    return a ? { value: a.value, offset: a.offset, empty: a.value.trim() === '' } : null;
  };
  const textAt = (el) => (el.textOffset >= 0 ? el.textOffset : el.offset);
  const asset = (path, offset, what) => {
    if (assets.length < lim.maxAssets) assets.push({ path, offset, what });
  };
  const summary = { name: null, publisher: null, version: null, architecture: null, displayName: null, devices: [], capabilities: { restricted: [], general: [], device: [], custom: [] }, allowedRestricted: [], applications: [], extensions: [], languages: [] };

  // Identity
  const identity = childOf(root, 'Identity', foundation);
  if (!identity) add('missing-identity', root.offset, 'the manifest has no Identity element, so the package has no name, publisher or version');
  else {
    const missing = ['Name', 'Publisher', 'Version'].filter((k) => !attrText(identity, k) || attrText(identity, k).empty);
    if (missing.length) add('missing-identity', identity.offset, `Identity has no ${listText(missing.map((k) => (attrText(identity, k) ? `${k} (it is empty)` : k)), 3)}`);
    const name = attrText(identity, 'Name');
    if (name && !name.empty) summary.name = name.value;
    const version = attrText(identity, 'Version');
    if (version && !version.empty) {
      summary.version = version.value;
      const q = parseQuad(version.value);
      if (!q.parts) add('invalid-version', version.offset, `the Version "${version.value.slice(0, 64)}" is not four 16-bit numbers: ${q.reason}`);
    }
    const arch = attrText(identity, 'ProcessorArchitecture');
    if (arch) {
      summary.architecture = arch.value;
      if (!ARCHITECTURES.includes(arch.value)) add('invalid-architecture', arch.offset, `the ProcessorArchitecture "${arch.value.slice(0, 40)}" is not one of ${ARCHITECTURES.join(', ')}`);
    }
    const publisher = attrText(identity, 'Publisher');
    if (publisher && !publisher.empty) {
      summary.publisher = publisher.value;
      const dn = parseDn(publisher.value);
      if (!dn.parts) add('invalid-publisher', publisher.offset + (dn.offset ?? 0), `the Publisher "${publisher.value.slice(0, 120)}" is not a distinguished name: ${dn.reason}`);
      if (certSubject !== null && publisher.value !== certSubject) add('publisher-mismatch', publisher.offset, `the Publisher "${publisher.value.slice(0, 160)}" is not the certificate subject "${certSubject.slice(0, 160)}": ${dnDifference(publisher.value, certSubject)}; signing with that certificate fails`);
    }
  }

  // Properties
  const properties = childOf(root, 'Properties', foundation);
  if (!properties) add('missing-properties', root.offset, 'the manifest has no Properties element, so the package has no display name, publisher display name or logo');
  else {
    const missing = [];
    for (const k of ['DisplayName', 'PublisherDisplayName', 'Logo']) {
      const el = childOf(properties, k, foundation);
      if (!el) missing.push(k);
      else if (el.text.trim() === '') missing.push(`${k} (it is empty)`);
      else if (k === 'DisplayName') summary.displayName = el.text.trim();
      else if (k === 'Logo') asset(el.text.trim(), textAt(el), 'the Logo of Properties');
    }
    if (missing.length) add('missing-properties', properties.offset, `Properties has no ${listText(missing, 3)}`);
  }

  // Dependencies and TargetDeviceFamily
  const dependencies = childOf(root, 'Dependencies', foundation);
  const families = dependencies ? childrenOf(dependencies, 'TargetDeviceFamily', foundation) : [];
  if (!dependencies) add('missing-target-device-family', root.offset, 'the manifest has no Dependencies element, so it names no TargetDeviceFamily and no Windows build');
  else if (!families.length) add('missing-target-device-family', dependencies.offset, 'Dependencies has no TargetDeviceFamily, so the package names no Windows build it runs on');
  const floor = parseQuad(config.minBuildFloor).parts;
  for (const tdf of families) {
    const name = attrText(tdf, 'Name');
    const min = attrText(tdf, 'MinVersion');
    const max = attrText(tdf, 'MaxVersionTested');
    const missing = [['Name', name], ['MinVersion', min], ['MaxVersionTested', max]].filter(([, v]) => !v || v.empty).map(([k]) => k);
    if (missing.length) add('missing-target-device-family', tdf.offset, `TargetDeviceFamily${name && !name.empty ? ` "${name.value.slice(0, 40)}"` : ''} has no ${listText(missing, 3)}`);
    const label = name && !name.empty ? name.value : 'the TargetDeviceFamily';
    const parsed = {};
    for (const [k, v] of [['MinVersion', min], ['MaxVersionTested', max]]) {
      if (!v || v.empty) continue;
      const q = parseQuad(v.value);
      if (!q.parts) add('invalid-target-version', v.offset, `the ${k} "${v.value.slice(0, 64)}" of ${label.slice(0, 40)} is not four 16-bit numbers: ${q.reason}`);
      else parsed[k] = q.parts;
    }
    if (parsed.MinVersion && parsed.MaxVersionTested && compareQuad(parsed.MinVersion, parsed.MaxVersionTested) > 0) {
      add('invalid-target-version', min.offset, `the MinVersion ${quadText(parsed.MinVersion)} of ${label.slice(0, 40)} is above its MaxVersionTested ${quadText(parsed.MaxVersionTested)}: the app would install only on builds it was never tested on`);
    }
    if (parsed.MinVersion && floor && compareQuad(parsed.MinVersion, floor) < 0) {
      add('min-version-below-floor', min.offset, `the MinVersion ${quadText(parsed.MinVersion)} of ${label.slice(0, 40)} (build ${parsed.MinVersion[2]}) is below the floor ${quadText(floor)} (build ${floor[2]}), so the package installs on builds the team may not test or Microsoft may no longer service`);
    }
    summary.devices.push({ name: name && !name.empty ? name.value : null, min: min && !min.empty ? min.value : null, max: max && !max.empty ? max.value : null, minBuild: parsed.MinVersion ? parsed.MinVersion[2] : null, maxBuild: parsed.MaxVersionTested ? parsed.MaxVersionTested[2] : null });
  }

  // Resources
  const resources = childOf(root, 'Resources', foundation);
  const languages = resources ? childrenOf(resources, 'Resource', foundation).map((r) => attrText(r, 'Language')).filter((l) => l && !l.empty) : [];
  if (!languages.length) add('missing-resource-language', resources ? resources.offset : root.offset, resources ? 'Resources has no Resource with a Language' : 'the manifest has no Resources element, so it declares no language');
  for (const l of languages) {
    summary.languages.push(l.value);
    const problem = languageTagProblem(l.value);
    if (problem) add('invalid-language-tag', l.offset, `the Language "${l.value.slice(0, 64)}" is not a well-formed BCP 47 tag: ${problem}`);
  }

  // Capabilities
  const capabilities = childOf(root, 'Capabilities', foundation);
  const allowed = new Set(config.allowedRestrictedCapabilities);
  for (const c of (capabilities ? capabilities.children : []).slice(0, lim.maxCapabilities)) {
    const group = groupOf(c.local, familyOf(c.uri));
    const name = attrText(c, 'Name');
    if (!group || !name || name.empty) continue;
    const note = capabilityNote(group, name.value);
    if (group === 'restricted') {
      if (allowed.has(name.value)) {
        summary.allowedRestricted.push(name.value);
        summary.capabilities.restricted.push(name.value);
        continue;
      }
      summary.capabilities.restricted.push(name.value);
      add('restricted-capability', name.offset, `${name.value.slice(0, 64)} is a restricted capability${note ? `: ${note}` : ''}; a Store submission must say why the app needs it, and the Store may refuse it`);
    } else {
      summary.capabilities[group].push(name.value);
      const kind = group === 'general' ? 'a general-use capability' : group === 'device' ? 'a device capability' : 'a custom capability, which needs approval of its own for the Store';
      add('general-capability', name.offset, `${name.value.slice(0, 64)} is ${kind}${note ? `: ${note}` : ''}`);
    }
  }

  // Applications
  const applications = childOf(root, 'Applications', foundation);
  const ids = new Map();
  const protocols = new Map();
  for (const app of (applications ? childrenOf(applications, 'Application', foundation) : []).slice(0, lim.maxApplications)) {
    const id = attrText(app, 'Id');
    const label = id && !id.empty ? `the application "${id.value.slice(0, 64)}"` : 'an application';
    if (!id || id.empty) add('invalid-application', app.offset, 'an Application has no Id');
    else if (ids.has(id.value)) add('duplicate-application-id', id.offset, `the Id "${id.value.slice(0, 64)}" is already used by the application at line ${lineOf(ids.get(id.value))}; each application of a package needs an Id of its own`);
    else ids.set(id.value, id.offset);
    const exe = attrText(app, 'Executable');
    const start = attrText(app, 'StartPage');
    const entry = attrText(app, 'EntryPoint');
    const runtime = app.attrs.find((a) => a.local === 'RuntimeBehavior' && familyOf(a.uri) === 'uap');
    if (!start || start.empty) {
      if (!exe || exe.empty) add('invalid-application', app.offset, `${label} has no Executable and no StartPage, so Windows has nothing to start`);
      else if (!asciiLower(exe.value).endsWith('.exe')) add('invalid-application', exe.offset, `the Executable "${exe.value.slice(0, 80)}" of ${label} does not end with .exe`);
      else if ((!entry || entry.empty) && !(runtime && RUNTIME_WITHOUT_ENTRYPOINT.includes(runtime.value))) add('invalid-application', app.offset, `${label} has an Executable but no EntryPoint and no uap10:RuntimeBehavior, so Windows does not know how to activate it`);
    }
    summary.applications.push({ id: id && !id.empty ? id.value : null, executable: exe && !exe.empty ? exe.value : null, entryPoint: entry && !entry.empty ? entry.value : null });

    const visual = childOf(app, 'VisualElements', foundationOrUap);
    if (!visual) add('missing-visual-elements', app.offset, `${label} has no uap:VisualElements, so it has no name, tile or icon in Start`);
    else {
      const missing = VISUAL_REQUIRED.filter((k) => !attrText(visual, k) || attrText(visual, k).empty);
      if (missing.length) add('missing-visual-elements', visual.offset, `the uap:VisualElements of ${label} has no ${listText(missing, 5)}`);
      for (const k of ['Square150x150Logo', 'Square44x44Logo']) {
        const v = attrText(visual, k);
        if (v && !v.empty) asset(v.value, v.offset, `the ${k} of ${label}`);
      }
      const parts = [['DefaultTile', ['Wide310x150Logo', 'Square71x71Logo', 'Square310x310Logo']], ['SplashScreen', ['Image']], ['LockScreen', ['BadgeLogo']]];
      for (const [child, keys] of parts) {
        const el = childOf(visual, child, foundationOrUap);
        if (!el) continue;
        for (const k of keys) {
          const v = attrText(el, k);
          if (v && !v.empty) asset(v.value, v.offset, `the ${k} of the ${child} of ${label}`);
        }
      }
    }

    const extensions = childOf(app, 'Extensions', foundation);
    for (const ext of extensions ? extensions.children.filter((e) => e.local === 'Extension' && anyFamily(e.uri)) : []) {
      const category = attrText(ext, 'Category');
      if (!category || category.empty) continue;
      const cat = category.value;
      if (cat === 'windows.protocol') {
        for (const p of childrenOf(ext, 'Protocol', inFamily('uap'))) {
          const pn = attrText(p, 'Name');
          if (!pn) {
            add('invalid-association', p.offset, `a protocol of ${label} has no Name`);
            continue;
          }
          const problem = protocolNameProblem(pn.value);
          const reserved = isReserved(pn.value, config.reservedProtocols);
          if (problem) add('invalid-association', pn.offset, `the protocol name "${pn.value.slice(0, 64)}" of ${label} is not a valid URI scheme: ${problem}`);
          else if (protocols.has(pn.value)) add('invalid-association', pn.offset, `the protocol "${pn.value.slice(0, 64)}" is already declared at line ${lineOf(protocols.get(pn.value))}; a protocol name is unique in the package`);
          if (reserved) add('reserved-protocol', pn.offset, `the protocol "${pn.value.slice(0, 64)}" of ${label} is reserved (${reserved}): Windows or the web already handles that scheme, so the registration competes with it for every link`);
          if (!protocols.has(pn.value)) protocols.set(pn.value, pn.offset);
          summary.extensions.push(`protocol ${pn.value}`);
          const logo = childOf(p, 'Logo', inFamily('uap'));
          if (logo && logo.text.trim()) asset(logo.text.trim(), textAt(logo), `the logo of the protocol "${pn.value.slice(0, 64)}"`);
        }
      } else if (cat === 'windows.fileTypeAssociation') {
        for (const fta of childrenOf(ext, 'FileTypeAssociation', inFamily('uap'))) {
          const fn = attrText(fta, 'Name');
          if (!fn) add('invalid-association', fta.offset, `a file type association of ${label} has no Name`);
          else {
            const problem = fileTypeNameProblem(fn.value);
            if (problem) add('invalid-association', fn.offset, `the file type association name "${fn.value.slice(0, 64)}" of ${label} is not valid: ${problem}`);
            summary.extensions.push(`file types ${fn.value}`);
          }
          const supported = childOf(fta, 'SupportedFileTypes', inFamily('uap'));
          const types = supported ? childrenOf(supported, 'FileType', inFamily('uap')) : [];
          if (!types.length) add('invalid-association', fta.offset, `the file type association${fn ? ` "${fn.value.slice(0, 64)}"` : ''} of ${label} names no FileType`);
          for (const t of types) {
            const v = t.text.trim();
            if (!v.startsWith('.') || v.length < 2 || /\s/.test(v)) add('invalid-association', textAt(t), `the FileType "${v.slice(0, 64)}" is not a file name extension such as .txt`);
          }
          const logo = childOf(fta, 'Logo', inFamily('uap'));
          if (logo && logo.text.trim()) asset(logo.text.trim(), textAt(logo), `the logo of the file type association${fn ? ` "${fn.value.slice(0, 64)}"` : ''}`);
        }
      } else if (Object.hasOwn(EXTENSION_NOTES, cat)) {
        summary.extensions.push(cat);
        const target = attrText(ext, 'Executable');
        add('extension-listed', category.offset, `${label} declares ${EXTENSION_NOTES[cat]}${target && !target.empty ? ` (${target.value.slice(0, 80)})` : ''}`);
      }
    }
  }
  summary.capabilities = Object.fromEntries(GROUPS.map((g) => [g, summary.capabilities[g]]));
  return { summary, findings, assets };
}
