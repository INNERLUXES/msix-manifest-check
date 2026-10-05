// The rules and the result. Each rule names the points of the public pages it rests on (src/data.js), says where it is
// the tool's own choice, and what to change before the release goes out. docs/method.md says exactly what each rule
// looks at and what it cannot see. The checks of one manifest are in src/manifest.js, and the check of the asset files
// on disk in src/assets.js.

import { LEVELS } from './data.js';
import { grouped, listText, plural } from './size.js';

export const RULES = [
  {
    id: 'missing-identity',
    key: 'missingIdentity',
    title: 'the package has no identity, or one with a part missing',
    basis: ['identityFields', 'packageChildren'],
    own: 'a manifest with no Identity element in the foundation namespace, and an Identity with no Name, Publisher or Version, or one that is empty',
    rule: () => 'a manifest whose Identity is missing or has no Name, Publisher or Version',
    fix: 'give Identity its Name, Publisher and Version; for the Store, take the Name and Publisher that Partner Center reserved for the app'
  },
  {
    id: 'invalid-version',
    key: 'invalidVersion',
    title: 'the version of the package is not four 16-bit numbers',
    basis: ['identityFields'],
    own: 'Identity Version that is not four whole numbers separated by dots, each from 0 to 65535 with no leading zero; the version of a .NET or C++ project often has three parts, or a build number above 65535',
    rule: () => 'an Identity Version that is not major.minor.build.revision with each part from 0 to 65535',
    fix: 'write the version as four numbers from 0 to 65535, such as 1.4.2.0; a build number of a pipeline above 65535 does not fit'
  },
  {
    id: 'invalid-architecture',
    key: 'invalidArchitecture',
    title: 'the processor architecture is not one Windows knows',
    basis: ['identityFields'],
    own: 'a ProcessorArchitecture other than x86, x64, arm, arm64, x86a64 or neutral, compared with its case, as the schema compares the values of a list; an Identity with no ProcessorArchitecture is not reported, because a package with no code may leave it out',
    rule: () => 'a ProcessorArchitecture that is not x86, x64, arm, arm64, x86a64 or neutral',
    fix: 'write one of x86, x64, arm, arm64, x86a64 or neutral, in lowercase'
  },
  {
    id: 'invalid-publisher',
    key: 'invalidPublisher',
    title: 'the publisher is not a distinguished name',
    basis: ['identityPublisher', 'certSubject'],
    own: 'a Publisher that is not TYPE=value parts separated by commas, with a CN among them; a value with a comma, a quote or an equals sign must be in double quotes or escaped',
    rule: () => 'an Identity Publisher that is not a distinguished name with a CN',
    fix: 'copy the subject of the signing certificate into Publisher, such as CN=Contoso Software, O=Contoso Corporation, C=US'
  },
  {
    id: 'publisher-mismatch',
    key: 'publisherMismatch',
    title: 'the publisher is not the subject of the signing certificate',
    basis: ['identityPublisher', 'certSubject', 'msixSigned'],
    own: 'only with --cert-subject: Identity Publisher against the subject given, compared as text, exactly; the message says which part differs, or that only the spacing or the order differs, because signing fails either way',
    rule: () => 'an Identity Publisher that differs from the subject given with --cert-subject',
    fix: 'set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names'
  },
  {
    id: 'missing-target-device-family',
    key: 'missingTargetDeviceFamily',
    title: 'the package names no device family to target',
    basis: ['tdfFields', 'packageChildren'],
    own: 'a manifest with no Dependencies, a Dependencies with no TargetDeviceFamily, and a TargetDeviceFamily with no Name, MinVersion or MaxVersionTested',
    rule: () => 'a manifest with no TargetDeviceFamily, or one with a part missing',
    fix: 'add <TargetDeviceFamily Name="Windows.Desktop" MinVersion="..." MaxVersionTested="..."/> to Dependencies, with the builds the app supports and was tested on'
  },
  {
    id: 'invalid-target-version',
    key: 'invalidTargetVersion',
    title: 'a device family version is not valid, or MinVersion is above MaxVersionTested',
    basis: ['tdfFields', 'tdfMeaning'],
    own: 'a MinVersion or MaxVersionTested that is not four 16-bit numbers, and a MinVersion higher than the MaxVersionTested of the same TargetDeviceFamily, which says the app was never tested on a build it installs on',
    rule: () => 'a TargetDeviceFamily version that is not a quad version, or a MinVersion above its MaxVersionTested',
    fix: 'write both versions as 10.0.build.0, with MinVersion at or below MaxVersionTested'
  },
  {
    id: 'min-version-below-floor',
    key: 'minVersionBelowFloor',
    title: 'the package installs on builds older than the floor',
    basis: ['tdfMeaning', 'servicedBuilds'],
    own: 'the tool\'s own choice: a MinVersion below minBuildFloor (10.0.17763.0 by default, a number in the configuration, never a date); the floor stands for the oldest build the team still supports and tests, and Microsoft\'s release information page lists the builds still serviced',
    rule: (config) => `a TargetDeviceFamily MinVersion below ${config.minBuildFloor}`,
    fix: 'raise MinVersion to a build the app is tested on and Microsoft still services, or lower minBuildFloor when the team supports the older build on purpose'
  },
  {
    id: 'restricted-capability',
    key: 'restrictedCapability',
    title: 'a restricted capability needs a justification at Store submission',
    basis: ['restrictedApproval', 'capabilityGroups'],
    own: 'every Capability of the rescap namespace family, found by its namespace URI and not by its prefix, that is not in allowedRestrictedCapabilities; a sideloaded package needs no approval, so this is a warning and not an error',
    rule: (config) => `a restricted capability not in allowedRestrictedCapabilities (${config.allowedRestrictedCapabilities.length ? listText(config.allowedRestrictedCapabilities, 5) : 'none allowed'})`,
    fix: 'remove the capability when the app does not need it; otherwise write down why the app needs it for the Store submission, and add it to allowedRestrictedCapabilities once it is approved'
  },
  {
    id: 'general-capability',
    key: 'generalCapability',
    title: 'a general-use, device or custom capability is declared',
    basis: ['capabilityGroups', 'capabilityList'],
    own: 'every Capability of the foundation or uap namespace family, every DeviceCapability and every CustomCapability, listed so that a reviewer sees what the app asks for; none of them is a problem by itself',
    rule: () => 'a capability that is not restricted, listed for review',
    fix: 'keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off'
  },
  {
    id: 'missing-properties',
    key: 'missingProperties',
    title: 'the package properties are missing a name or logo',
    basis: ['propertiesFields', 'packageChildren'],
    own: 'a manifest with no Properties, and a Properties with no DisplayName, PublisherDisplayName or Logo, or with one that is empty',
    rule: () => 'a manifest whose Properties lack DisplayName, PublisherDisplayName or Logo',
    fix: 'add DisplayName, PublisherDisplayName and Logo to Properties; for the Store, use the names reserved in Partner Center'
  },
  {
    id: 'missing-asset',
    key: 'missingAsset',
    title: 'a logo or visual asset the manifest names is not on disk',
    basis: ['propertiesFields', 'visualElementsScales', 'qualifiedNames'],
    own: 'only with --root: the Logo of Properties, the logos of uap:VisualElements, its DefaultTile, SplashScreen and LockScreen, and the logos of protocols and file types, looked for under the root by the path the manifest gives, with its case ignored as Windows does; a file with qualifiers in its name (Logo.scale-200.png, Logo.targetsize-48_altform-unplated.png) or in a folder of qualifiers (scale-200/Logo.png) counts; a path that leaves the root, a symbolic link and an ms-appx or other address are reported',
    rule: () => 'a logo path of the manifest with no file under --root, plain or with qualifiers',
    fix: 'add the image to the package under that path, in at least one scale, or correct the path in the manifest'
  },
  {
    id: 'invalid-application',
    key: 'invalidApplication',
    title: 'an application cannot be started as written',
    basis: ['applicationFields', 'applicationActivation'],
    own: 'an Application with no Id; with no StartPage and no Executable; with an Executable that does not end with .exe; and with an Executable but no StartPage, no EntryPoint and no uap10:RuntimeBehavior of packagedClassicApp or win32App',
    rule: () => 'an Application with no Id, or with no way to start it',
    fix: 'give the application its Id and Executable, and EntryPoint="Windows.FullTrustApplication" for a desktop app (or uap10:RuntimeBehavior and uap10:TrustLevel)'
  },
  {
    id: 'duplicate-application-id',
    key: 'duplicateApplicationId',
    title: 'two applications of the package have the same Id',
    basis: ['applicationFields'],
    own: 'two Application elements with the same Id, compared with their case; the second one is reported, with the line of the first',
    rule: () => 'an Application Id used twice in one manifest',
    fix: 'give each application of the package an Id of its own, and keep the Id of a published app as it is, because the Start tile follows it'
  },
  {
    id: 'missing-visual-elements',
    key: 'missingVisualElements',
    title: 'an application is missing the visual elements Windows shows',
    basis: ['visualElementsFields'],
    own: 'an Application with no VisualElements of the uap namespace family, and a VisualElements with no DisplayName, Description, BackgroundColor, Square150x150Logo or Square44x44Logo, or with one that is empty; all that is missing is named in one finding',
    rule: () => 'an Application whose uap:VisualElements is missing or lacks a required attribute',
    fix: 'give uap:VisualElements its DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo'
  },
  {
    id: 'invalid-association',
    key: 'invalidAssociation',
    title: 'a protocol or file type association has a name that is not valid',
    basis: ['protocolName', 'protocolLowercase', 'fileTypeName'],
    own: 'a protocol Name that is not 2 to 2,048 characters, a lowercase letter followed by lowercase letters, digits, +, - or . (the form of a URI scheme); a protocol named twice in the package; a file type association Name that is not 1 to 64 lowercase characters with no space; and a FileType that does not start with a dot or holds a space',
    rule: () => 'a protocol or file type association name, or a file type, that Windows does not take',
    fix: 'name the protocol with a lowercase scheme of its own, such as contoso-notes, and the file type association with a lowercase name; write each FileType as .ext'
  },
  {
    id: 'reserved-protocol',
    key: 'reservedProtocol',
    title: 'a protocol takes a scheme that Windows or the web already handles',
    basis: ['builtInSchemes', 'protocolLowercase'],
    own: 'the tool\'s own choice: a protocol Name in reservedProtocols (http, https, file, ftp, mailto, microsoft-edge and every name starting with ms- by default), compared without case; an app that registers one competes with the handlers of Windows for every link of that scheme',
    rule: (config) => `a protocol named ${listText(config.reservedProtocols, 8) || 'in an empty list'}`,
    fix: 'use a scheme of the app\'s own, such as contoso-notes; to open web links, let the default browser handle them'
  },
  {
    id: 'extension-listed',
    key: 'extensionListed',
    title: 'an extension changes how the app runs with Windows',
    basis: ['extensionsDesktop', 'appService'],
    own: 'every application extension of the category windows.startupTask, windows.fullTrustProcess, windows.appService, windows.comServer, windows.appExecutionAlias or windows.firewallRules, listed with what it implies so that a reviewer sees it',
    rule: () => 'a startup task, full-trust process, app service, COM server, execution alias or firewall rule, listed for review',
    fix: 'keep the extension when the app needs it, and make sure the release notes and the Store listing say what it does'
  },
  {
    id: 'missing-resource-language',
    key: 'missingResourceLanguage',
    title: 'the package declares no language',
    basis: ['packageLanguage', 'resourceLanguage'],
    own: 'a manifest with no Resources, or with no Resource that has a Language',
    rule: () => 'a manifest with no Resource Language',
    fix: 'add <Resources><Resource Language="en-US"/></Resources>, or Language="x-generate" in Package.appxmanifest for Visual Studio to fill in'
  },
  {
    id: 'invalid-language-tag',
    key: 'invalidLanguageTag',
    title: 'a resource language is not a well-formed language tag',
    basis: ['resourceLanguage', 'langTagSyntax'],
    own: 'a Resource Language that is not a well-formed BCP 47 tag: subtags of letters and digits separated by hyphens, in the order language, script, region, variants, extensions and private use; whether a subtag is in the IANA registry is not checked',
    rule: () => 'a Resource Language that is not a well-formed BCP 47 tag',
    fix: 'write the language as a BCP 47 tag with hyphens, such as en-US, de-DE or zh-Hans-CN'
  },
  {
    id: 'unreadable-manifest',
    key: null,
    title: 'a manifest that cannot be read',
    basis: ['xxeDoctype', 'manifestSigned'],
    own: 'a file over its size limit, a binary file, a file that is not valid UTF-8 or UTF-16 with its byte order mark, XML that is not well formed or that has a DOCTYPE or a declared entity, a prefix that is not declared, and a root element that is not Package of the foundation namespace; nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a file that the tool could not read as a package manifest',
    fix: 'save the manifest as UTF-8 or UTF-16 with its byte order mark, as well-formed XML with Package of the foundation namespace at its root'
  },
  {
    id: 'scan-limit',
    key: null,
    title: 'the input is larger than the limits of a run',
    basis: ['xxeDoctype'],
    own: 'a folder with more entries, or more manifests or asset references in all, than the limits of docs/limits.md; the rest is not read, so the run fails; this rule cannot be set lower or off',
    rule: () => 'a folder or a set of inputs past a limit of the run',
    fix: 'check each package in its own run'
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is at or above another.
export const atOrAbove = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// The result: the run fails when a finding is at or above the level failOn. { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const counts = ['error', 'warning', 'info'].filter((l) => byLevel[l]).map((l) => `${grouped(byLevel[l])} ${l}`);
  const text = failing
    ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`
    : `PASS - no finding at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
