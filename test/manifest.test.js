import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHITECTURES, MAX_PROTOCOL_LENGTH, fileTypeNameProblem, isReserved, protocolNameProblem } from '../src/index.js';
import { GOOD, NS, SUBJECT, columnOf, configOf, goodWith, lineOf, manifestOf, ofRule, rulesOf } from './helpers.js';

// The checks of one manifest, read in memory: each rule with the form that is reported and the form next to it that is
// not, each finding at the line built for it.

test('the good manifest gives no finding, and its summary reads the identity, the builds and the languages', () => {
  const m = manifestOf(GOOD, { certSubject: SUBJECT });
  assert.deepEqual(m.findings, []);
  assert.equal(m.summary.name, 'Kestrel.Tally');
  assert.equal(m.summary.publisher, SUBJECT);
  assert.equal(m.summary.version, '1.4.2.0');
  assert.equal(m.summary.architecture, 'x64');
  assert.deepEqual(m.summary.devices, [{ name: 'Windows.Desktop', min: '10.0.19041.0', max: '10.0.22621.0', minBuild: 19041, maxBuild: 22621 }]);
  assert.deepEqual(m.summary.languages, ['en-US']);
  assert.deepEqual(m.summary.extensions, ['protocol kestrel-tally', 'file types tally']);
  assert.deepEqual(m.assets.map((a) => a.path), ['Assets\\StoreLogo.png', 'Assets\\Square150x150Logo.png', 'Assets\\Square44x44Logo.png']);
});

test('missing-identity: no Identity, and an Identity with no Name, Publisher or Version, or an empty one', () => {
  const none = goodWith([`<Identity Name="Kestrel.Tally" Publisher="${SUBJECT}" Version="1.4.2.0" ProcessorArchitecture="x64" />`, '']);
  assert.deepEqual(ofRule(none, 'missing-identity').map((f) => f.line), [lineOf(none, '<Package')]);
  const noVersion = goodWith([' Version="1.4.2.0"', '']);
  assert.match(ofRule(noVersion, 'missing-identity')[0].found, /Identity has no Version$/);
  const empty = goodWith(['Name="Kestrel.Tally"', 'Name=" "'], [' Version="1.4.2.0"', '']);
  assert.match(ofRule(empty, 'missing-identity')[0].found, /Identity has no Name \(it is empty\) and Version$/);
  assert.deepEqual(ofRule(GOOD, 'missing-identity'), []);
});

test('invalid-version: four parts of 0 to 65535 with no leading zero, and nothing else', () => {
  for (const bad of ['1.4.2', '1.4.2.0.0', '1.4.70000.0', '1.04.2.0', '1.4.x.0', '1.4..0', 'v1.4.2.0', '1.4.2.-1']) {
    const text = goodWith(['Version="1.4.2.0"', `Version="${bad}"`]);
    const f = ofRule(text, 'invalid-version');
    assert.equal(f.length, 1, bad);
    assert.equal(f[0].column, columnOf(text, bad), bad);
  }
  for (const good of ['0.0.0.0', '65535.65535.65535.65535', '10.0.19041.0']) assert.deepEqual(ofRule(goodWith(['Version="1.4.2.0"', `Version="${good}"`]), 'invalid-version'), [], good);
  assert.match(ofRule(goodWith(['Version="1.4.2.0"', 'Version="1.4.2"']), 'invalid-version')[0].found, /it has 3 parts, not four/);
});

test('invalid-architecture: the six values, with their case; none at all is not reported', () => {
  for (const a of ARCHITECTURES) assert.deepEqual(ofRule(goodWith(['"x64"', `"${a}"`]), 'invalid-architecture'), [], a);
  for (const a of ['X64', 'amd64', 'ARM64', 'any', '']) assert.equal(ofRule(goodWith(['"x64"', `"${a}"`]), 'invalid-architecture').length, 1, a);
  assert.deepEqual(rulesOf(goodWith([' ProcessorArchitecture="x64"', ''])), []);
});

test('invalid-publisher: a distinguished name with a CN, and the forms that are not one', () => {
  const ok = ['CN=Kestrel', 'CN=Kestrel Works, O="Kestrel, Ltd", C=NZ', 'CN=A\\, B, O=C', 'O=Kestrel + OU=Apps, CN=Tally', '2.5.4.3=Kestrel, CN=Tally'];
  for (const p of ok) assert.deepEqual(ofRule(goodWith([`Publisher="${SUBJECT}"`, `Publisher="${p.split('"').join('&quot;')}"`]), 'invalid-publisher'), [], p);
  const bad = [['Kestrel Works', /no = after it/], ['O=Kestrel, C=NZ', /no CN/], ['CN=Kestrel,', /ends with a separator/], ['CN=', /empty value/], ['CN=Kestrel; O=K', /semicolon/], ['CN=a=b', /character "="/], ['CN="Kestrel', /not closed/], ['9N=Kestrel', /not a type/]];
  for (const [p, reason] of bad) {
    const f = ofRule(goodWith([`Publisher="${SUBJECT}"`, `Publisher="${p.split('"').join('&quot;')}"`]), 'invalid-publisher');
    assert.equal(f.length, 1, p);
    assert.match(f[0].found, reason, p);
  }
});

test('publisher-mismatch: only with a subject, compared exactly, with the part that differs', () => {
  assert.deepEqual(ofRule(GOOD, 'publisher-mismatch'), [], 'no subject given');
  assert.deepEqual(ofRule(GOOD, 'publisher-mismatch', { certSubject: SUBJECT }), []);
  const cases = [
    ['CN=Kestrel Works Ltd, O=Kestrel Works Ltd, C=NZ', /the CN is "Kestrel Works" in the manifest and "Kestrel Works Ltd" in the certificate subject/],
    ['CN=Kestrel Works,O=Kestrel Works Ltd,C=NZ', /spacing or quoting/],
    ['O=Kestrel Works Ltd, CN=Kestrel Works, C=NZ', /another order/],
    ['CN=Kestrel Works, O=Kestrel Works Ltd, C=NZ, L=Nelson', /the certificate subject has L=Nelson that the manifest does not/],
    ['CN=Kestrel Works, O=Kestrel Works Ltd', /the manifest has C=NZ that the certificate subject does not/],
    ['CN=Kestrel Works, OU=Kestrel Works Ltd, C=NZ', /the manifest has O=Kestrel Works Ltd where the certificate subject has OU=Kestrel Works Ltd/]
  ];
  for (const [subject, reason] of cases) {
    const f = ofRule(GOOD, 'publisher-mismatch', { certSubject: subject });
    assert.equal(f.length, 1, subject);
    assert.match(f[0].found, reason, subject);
    assert.equal(f[0].line, lineOf(GOOD, 'Publisher='));
  }
});

test('missing-target-device-family: no Dependencies, no TargetDeviceFamily, and one with a part missing', () => {
  const tdf = '<TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.22621.0" />';
  assert.match(ofRule(goodWith([`<Dependencies>\n    ${tdf}\n  </Dependencies>`, '']), 'missing-target-device-family')[0].found, /no Dependencies element/);
  assert.match(ofRule(goodWith([tdf, '']), 'missing-target-device-family')[0].found, /Dependencies has no TargetDeviceFamily/);
  assert.match(ofRule(goodWith([' MaxVersionTested="10.0.22621.0"', '']), 'missing-target-device-family')[0].found, /TargetDeviceFamily "Windows.Desktop" has no MaxVersionTested/);
  assert.match(ofRule(goodWith(['Name="Windows.Desktop" ', '']), 'missing-target-device-family')[0].found, /TargetDeviceFamily has no Name/);
  assert.deepEqual(ofRule(GOOD, 'missing-target-device-family'), []);
});

test('invalid-target-version: versions that are not quad, and MinVersion above MaxVersionTested; equal is fine', () => {
  const bad = goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.19041"']);
  assert.match(ofRule(bad, 'invalid-target-version')[0].found, /the MinVersion "10.0.19041" of Windows.Desktop is not four 16-bit numbers/);
  const order = goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.22631.0"']);
  const f = ofRule(order, 'invalid-target-version');
  assert.equal(f.length, 1);
  assert.equal(f[0].column, columnOf(order, '10.0.22631.0'));
  assert.match(f[0].found, /above its MaxVersionTested 10.0.22621.0/);
  assert.deepEqual(ofRule(goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.22621.0"']), 'invalid-target-version'), []);
  assert.deepEqual(ofRule(goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.22621.1"']), 'invalid-target-version').length, 1, 'the revision counts too');
});

test('min-version-below-floor: below the default floor of build 17763 or the one configured, and not at it', () => {
  const below = goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.17134.0"']);
  assert.match(ofRule(below, 'min-version-below-floor')[0].found, /\(build 17134\) is below the floor 10.0.17763.0 \(build 17763\)/);
  assert.deepEqual(ofRule(goodWith(['MinVersion="10.0.19041.0"', 'MinVersion="10.0.17763.0"']), 'min-version-below-floor'), []);
  const config = configOf({ minBuildFloor: '10.0.22000.0' });
  assert.equal(ofRule(GOOD, 'min-version-below-floor', { config }).length, 1);
  assert.deepEqual(ofRule(below, 'min-version-below-floor', { config: configOf({ minBuildFloor: '10.0.10240.0' }) }), []);
});

test('restricted-capability: found by the namespace URI under any prefix, each with its note, unless allowed', () => {
  const caps = `<Capabilities>\n    <rescap:Capability Name="runFullTrust" />\n    <locked:Capability xmlns:locked="${NS.rescap}" Name="allowElevation" />\n    <Capability Name="internetClient" />\n  </Capabilities>\n</Package>`;
  const text = goodWith(['</Package>', caps]);
  const f = ofRule(text, 'restricted-capability');
  assert.deepEqual(f.map((x) => x.line), [lineOf(text, 'runFullTrust'), lineOf(text, 'allowElevation')]);
  assert.match(f[0].found, /^runFullTrust is a restricted capability: the package holds full-trust code/);
  assert.match(f[1].found, /allowElevation is a restricted capability: the app can run with administrator rights/);
  assert.match(f[1].found, /a Store submission must say why the app needs it/);
  const m = manifestOf(text, { config: configOf({ allowedRestrictedCapabilities: ['runFullTrust'] }) });
  assert.deepEqual(m.findings.filter((x) => x.rule === 'restricted-capability').map((x) => x.line), [lineOf(text, 'allowElevation')]);
  assert.deepEqual(m.summary.allowedRestricted, ['runFullTrust']);
  assert.deepEqual(m.summary.capabilities.restricted, ['runFullTrust', 'allowElevation']);
  // The prefix rescap bound to the uap namespace makes the capability a general one.
  const wrong = goodWith([`xmlns:rescap="${NS.rescap}"`, `xmlns:rescap="${NS.uap}"`], ['</Package>', '<Capabilities><rescap:Capability Name="picturesLibrary" /></Capabilities></Package>']);
  assert.deepEqual(rulesOf(wrong), ['general-capability']);
  const unknown = goodWith(['</Package>', '<Capabilities><rescap:Capability Name="someNewThing" /></Capabilities></Package>']);
  assert.equal(ofRule(unknown, 'restricted-capability')[0].found, 'someNewThing is a restricted capability; a Store submission must say why the app needs it, and the Store may refuse it');
});

test('general-capability: general, device and custom capabilities are listed as info with what they give', () => {
  const caps = `<Capabilities><Capability Name="internetClientServer" /><uap:Capability Name="picturesLibrary" /><DeviceCapability Name="microphone" /><uap4:CustomCapability xmlns:uap4="http://schemas.microsoft.com/appx/manifest/uap/windows10/4" Name="Kestrel.Hardware_1234abcd" /></Capabilities></Package>`;
  const m = manifestOf(goodWith(['</Package>', caps]));
  assert.deepEqual(m.findings.map((f) => f.rule), ['general-capability', 'general-capability', 'general-capability', 'general-capability']);
  assert.match(m.findings[0].found, /internetClientServer is a general-use capability: incoming connections/);
  assert.match(m.findings[1].found, /picturesLibrary is a general-use capability: the Pictures library/);
  assert.match(m.findings[2].found, /microphone is a device capability/);
  assert.match(m.findings[3].found, /a custom capability, which needs approval of its own/);
  assert.deepEqual(m.summary.capabilities, { restricted: [], general: ['internetClientServer', 'picturesLibrary'], device: ['microphone'], custom: ['Kestrel.Hardware_1234abcd'] });
  // A capability of a namespace the table does not know is not counted.
  assert.deepEqual(rulesOf(goodWith(['</Package>', '<Capabilities><x:Capability xmlns:x="urn:other" Name="a" /></Capabilities></Package>'])), []);
});

test('missing-properties: no Properties, and one with no DisplayName, PublisherDisplayName or Logo', () => {
  assert.match(ofRule(goodWith(['<PublisherDisplayName>Kestrel Works</PublisherDisplayName>', '']), 'missing-properties')[0].found, /Properties has no PublisherDisplayName$/);
  assert.match(ofRule(goodWith(['<Logo>Assets\\StoreLogo.png</Logo>', '<Logo> </Logo>']), 'missing-properties')[0].found, /Logo \(it is empty\)/);
  const none = GOOD.replace(/ {2}<Properties>[\s\S]*<\/Properties>\n/, '');
  assert.match(ofRule(none, 'missing-properties')[0].found, /no Properties element/);
  // A DisplayName of another namespace is not the DisplayName of Properties.
  assert.equal(ofRule(goodWith(['<DisplayName>Kestrel Tally</DisplayName>', '<uap:DisplayName>Kestrel Tally</uap:DisplayName>']), 'missing-properties').length, 1);
});

test('invalid-application: an Id, an Executable ending with .exe, and an EntryPoint or a runtime behavior', () => {
  const cases = [
    [['Id="Tally" ', ''], /an Application has no Id/],
    [['Executable="Tally.exe" ', ''], /has no Executable and no StartPage/],
    [['Executable="Tally.exe"', 'Executable="Tally.dll"'], /does not end with .exe/],
    [[' EntryPoint="Windows.FullTrustApplication"', ''], /has an Executable but no EntryPoint and no uap10:RuntimeBehavior/]
  ];
  for (const [pair, reason] of cases) {
    const f = ofRule(goodWith(pair), 'invalid-application');
    assert.equal(f.length, 1, String(pair));
    assert.match(f[0].found, reason);
  }
  const runtime = goodWith([' EntryPoint="Windows.FullTrustApplication"', ` xmlns:uap10="${NS.uap10}" uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL"`]);
  assert.deepEqual(ofRule(runtime, 'invalid-application'), []);
  const windowsApp = goodWith([' EntryPoint="Windows.FullTrustApplication"', ` xmlns:uap10="${NS.uap10}" uap10:RuntimeBehavior="windowsApp"`]);
  assert.equal(ofRule(windowsApp, 'invalid-application').length, 1, 'windowsApp still needs an EntryPoint');
  const page = goodWith(['Executable="Tally.exe" EntryPoint="Windows.FullTrustApplication"', 'StartPage="index.html"']);
  assert.deepEqual(ofRule(page, 'invalid-application'), [], 'a start page needs neither');
  assert.deepEqual(ofRule(goodWith(['Executable="Tally.exe"', 'Executable="bin\\TALLY.EXE"']), 'invalid-application'), []);
});

test('duplicate-application-id: the second application with an Id, with the line of the first; case counts', () => {
  const app = GOOD.slice(GOOD.indexOf('    <Application '), GOOD.indexOf('</Application>') + '</Application>'.length);
  const text = GOOD.replace('</Application>', `</Application>\n${app}`);
  const f = ofRule(text, 'duplicate-application-id');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'Id="Tally"', 2));
  assert.match(f[0].found, new RegExp(`already used by the application at line ${lineOf(text, 'Id="Tally"')}`));
  assert.deepEqual(ofRule(GOOD.replace('</Application>', `</Application>\n${app.replace('Id="Tally"', 'Id="tally"')}`), 'duplicate-application-id'), []);
});

test('missing-visual-elements: none at all, and every attribute that is missing named in one finding', () => {
  const none = GOOD.replace(/ {6}<uap:VisualElements[^\n]*\n/, '');
  assert.match(ofRule(none, 'missing-visual-elements')[0].found, /has no uap:VisualElements/);
  const two = goodWith([' Description="Counts things"', ''], [' BackgroundColor="transparent"', ' BackgroundColor=""']);
  const f = ofRule(two, 'missing-visual-elements');
  assert.equal(f.length, 1);
  assert.match(f[0].found, /the uap:VisualElements of the application "Tally" has no Description and BackgroundColor$/);
  // VisualElements found by its namespace under another prefix.
  const other = goodWith(['<uap:VisualElements', `<v:VisualElements xmlns:v="${NS.uap3}"`]);
  assert.deepEqual(ofRule(other, 'missing-visual-elements'), []);
});

test('invalid-association: protocol names, file type association names and file types', () => {
  for (const bad of ['Kestrel-Tally', 'k', '1tally', 'kestrel_tally', 'kestrel tally']) assert.equal(ofRule(goodWith(['Name="kestrel-tally"', `Name="${bad}"`]), 'invalid-association').length, 1, bad);
  for (const good of ['kt', 'kestrel+tally', 'kestrel.tally-2']) assert.deepEqual(ofRule(goodWith(['Name="kestrel-tally"', `Name="${good}"`]), 'invalid-association'), [], good);
  assert.match(ofRule(goodWith(['Name="tally"', 'Name="Tally Files"']), 'invalid-association')[0].found, /not all lowercase/);
  assert.match(ofRule(goodWith(['Name="tally"', 'Name="tally files"']), 'invalid-association')[0].found, /holds a space/);
  assert.match(ofRule(goodWith(['<uap:FileType>.tally</uap:FileType>', '<uap:FileType>tally</uap:FileType>']), 'invalid-association')[0].found, /the FileType "tally" is not a file name extension/);
  assert.match(ofRule(goodWith(['<uap:FileType>.tally</uap:FileType>', '']), 'invalid-association')[0].found, /names no FileType/);
  const twice = goodWith(['<uap:Protocol Name="kestrel-tally" />', '<uap:Protocol Name="kestrel-tally" />\n        </uap:Extension>\n        <uap:Extension Category="windows.protocol">\n          <uap:Protocol Name="kestrel-tally" />']);
  assert.match(ofRule(twice, 'invalid-association')[0].found, new RegExp(`already declared at line ${lineOf(twice, 'kestrel-tally')}`));
  assert.equal(protocolNameProblem('a'.repeat(MAX_PROTOCOL_LENGTH)), null);
  assert.match(protocolNameProblem('a'.repeat(MAX_PROTOCOL_LENGTH + 1)), /not 2 to 2,048/);
  assert.equal(fileTypeNameProblem('a'.repeat(64)), null);
  assert.match(fileTypeNameProblem('a'.repeat(65)), /not 1 to 64/);
});

test('reserved-protocol: the default names and prefixes, without case, and a list of the configuration', () => {
  for (const name of ['http', 'https', 'file', 'mailto', 'ms-settings', 'ms-kestrel']) {
    const f = ofRule(goodWith(['Name="kestrel-tally"', `Name="${name}"`]), 'reserved-protocol');
    assert.equal(f.length, 1, name);
    assert.match(f[0].found, /is reserved/);
  }
  assert.deepEqual(ofRule(goodWith(['Name="kestrel-tally"', 'Name="msx-tally"']), 'reserved-protocol'), []);
  assert.deepEqual(ofRule(goodWith(['Name="kestrel-tally"', 'Name="https"']), 'reserved-protocol', { config: configOf({ reservedProtocols: ['kestrel-*'] }) }), []);
  assert.equal(ofRule(GOOD, 'reserved-protocol', { config: configOf({ reservedProtocols: ['kestrel-*'] }) }).length, 1);
  assert.equal(isReserved('MS-Settings', ['ms-*']), 'ms-*');
  assert.equal(isReserved('http2', ['http']), null);
});

test('extension-listed: startup tasks, full-trust processes, app services and COM servers, by category in any namespace', () => {
  const ext = `<desktop:Extension Category="windows.startupTask" Executable="Agent.exe" EntryPoint="Windows.FullTrustApplication"><desktop:StartupTask TaskId="Agent" Enabled="true" DisplayName="Agent" /></desktop:Extension>
        <desktop:Extension Category="windows.fullTrustProcess" Executable="Helper.exe" />
        <uap:Extension Category="windows.appService"><uap3:AppService xmlns:uap3="${NS.uap3}" Name="com.kestrel.tally" /></uap:Extension>
        <com:Extension xmlns:com="${NS.com}" Category="windows.comServer" />
        <uap:Extension Category="windows.backgroundTasks" />
      </Extensions>`;
  const m = manifestOf(goodWith(['</Extensions>', ext]));
  const f = m.findings.filter((x) => x.rule === 'extension-listed');
  assert.equal(f.length, 4);
  assert.match(f[0].found, /declares a startup task: .* \(Agent.exe\)$/);
  assert.match(f[1].found, /a full-trust process/);
  assert.match(f[2].found, /an app service/);
  assert.match(f[3].found, /a COM server/);
  assert.deepEqual(m.findings.filter((x) => x.rule !== 'extension-listed'), []);
});

test('missing-resource-language and invalid-language-tag', () => {
  assert.match(ofRule(goodWith(['<Resource Language="en-US" />', '']), 'missing-resource-language')[0].found, /Resources has no Resource with a Language/);
  assert.match(ofRule(goodWith(['<Resources>\n    <Resource Language="en-US" />\n  </Resources>', '']), 'missing-resource-language')[0].found, /no Resources element/);
  for (const good of ['en', 'en-US', 'zh-Hans-CN', 'x-generate', 'es-419', 'sl-IT-nedis', 'sl-rozaj-biske', 'en-a-bbb-x-ccc', 'i-klingon', 'EN-us']) assert.deepEqual(ofRule(goodWith(['Language="en-US"', `Language="${good}"`]), 'invalid-language-tag'), [], good);
  for (const bad of ['en_US', 'e', 'en--US', 'en-US-', 'english-language-pack', 'en-a', 'en-US-x', 'en-a-bb-a-cc', 'sl-rozaj-rozaj']) assert.equal(ofRule(goodWith(['Language="en-US"', `Language="${bad}"`]), 'invalid-language-tag').length, 1, bad);
});

test('a root that is not Package of the foundation namespace is not a manifest', () => {
  assert.throws(() => manifestOf('<Package><Identity /></Package>'), /the root element is <Package> with no namespace, not Package of the foundation namespace/);
  assert.throws(() => manifestOf(`<x:Package xmlns:x="${NS.uap}" />`), /of the namespace http/);
  assert.throws(() => manifestOf(`<Manifest xmlns="${NS.foundation}" />`), /the root element is <Manifest>/);
  // The default namespace bound to a prefix is the same Package.
  const prefixed = `<f:Package xmlns:f="${NS.foundation}"><f:Identity Name="a" Publisher="CN=a" Version="1.0.0.0" /></f:Package>`;
  assert.equal(manifestOf(prefixed).summary.name, 'a');
});
