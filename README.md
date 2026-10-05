# msix-manifest-check

MSIX package manifest check, run before a Microsoft Store or sideload release. Give it the manifest of a Windows app
packaged with MSIX (Package.appxmanifest of the packaging project, or AppxManifest.xml of the package layout), the
folder its images live in and the subject of the certificate it will be signed with. It reads them from disk, fetches
nothing, and lists what stops a signing step, a Store submission or an install: an identity with a part missing, a
version that is not four 16-bit numbers, a publisher that is not the subject of the signing certificate, device family
versions in the wrong order or below a build floor, restricted capabilities that need a justification, properties,
visual elements and logo files that are missing, applications that cannot start or share an Id, protocol and file type
names that are not valid or reserved, and resource languages that are missing or not well formed. Each manifest gets a
summary of its identity, version, Windows builds and capabilities by group. Every finding has its file, line and column
and what to change, and the run exits with a code a pipeline can act on.

**It is a check before the release, not a signature verification and not a Store certification.** It reads the files on
disk, never opens a certificate and never calls the Store; it checks that the manifest says what signing and
submission need, and a clean run means only that none of the problems of its rules were found.

The Publisher of the manifest must match the subject of the certificate the package is signed with
(https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing), the Version is four parts
(https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-identity), and a restricted
capability such as runFullTrust or broadFileSystemAccess needs a reason at Store submission
(https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/app-capability-declarations). These mistakes surface
late, in a signing step that fails or a submission that is sent back, though each is visible in one XML file before
the build. This tool reads that file, by namespace and not by prefix, on every release.

- **One check per problem.** Twenty rules, each with what it looks at, what it cannot see, the public pages it rests
  on and what to change, and two rules of input problems that are always errors.
- **Namespaces by URI.** `uap`, `rescap` and `desktop` are only the usual prefixes; elements are found by the namespace
  URI their prefix is bound to, from one documented table, so a prefix of another name hides nothing.
- **A safe reader of its own.** A small XML reader with no dependency that refuses every DOCTYPE and ENTITY declaration,
  so no manifest can make it read a file or expand without end, and reads UTF-8 and UTF-16.
- **No dates.** The build floor is a build number in the configuration, the clock is never read, and the same files
  always give the same report.
- Reports as text, JSON, CSV with one row per finding and GitHub workflow annotations, with an exit code for a
  pipeline: `0` no finding at or above the `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 118
pass 116
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link, a device or file permissions (links in a folder to a file and to a folder, a folder and a root named
through a link, a logo reached through a link, `/dev/zero` named as a manifest, and a manifest with no read access);
they are guarded with `process.platform`, run on Linux and macOS, and none of them asserts a line.
`npm run test:coverage` runs the same tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/msix-manifest-check.git
cd msix-manifest-check
node bin/msix-manifest-check.js examples/messy/Package.appxmanifest --root examples/messy --cert-subject "CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB" --config examples/config.json
```

Or without a clone, on your own packaging project:

```
npx --yes github:INNERLUXES/msix-manifest-check App.Package/Package.appxmanifest --root App.Package --cert-subject "CN=Contoso Software, O=Contoso Corporation, C=US"
```

`examples/` holds two made-up packages. `examples/messy/` is a company whose accounting app is about to be sent to the
Store with a manifest that has gone wrong: a publisher that is not the subject of its certificate, a version with a
build number above 65535, a device family whose MinVersion is above MaxVersionTested and another below the build
floor, runFullTrust and broadFileSystemAccess under a prefix of another name, a logo that is not in its Assets folder,
a protocol named like a scheme of Windows, a file type association name with capitals and a space, a second
application that reuses the Id of the first and misses its EntryPoint and Description, and a language written with an
underscore. It also holds what must not be reported: logos found through their scale qualifiers, a well-formed language
and a startup task, which is only listed. `examples/clean/` is a company with a manifest in good order, whose logos are
found plain, with qualifiers in their names and in a qualifier folder.

## Usage

```
msix-manifest-check <manifest or folder>... [--root <folder>] [--cert-subject "<CN=...>"] [--config <file>] [options]
```

```
--root <folder>           the root of the package; the logo and image paths of the manifest are looked for under it,
                          with or without qualifiers such as .scale-200
--cert-subject <subject>  the subject of the signing certificate, such as "CN=Contoso, O=Contoso, C=US"; the
                          Publisher of the manifest must be exactly this text
--config <file>           settings in strict JSON: rules, minBuildFloor, allowedRestrictedCapabilities,
                          reservedProtocols, minSeverity and failOn (--print-defaults shows them)
--format <name>           text, json, csv or github (default: text); csv writes one row per finding, github writes
                          workflow commands that GitHub shows as annotations
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: minSeverity of
                          the configuration, else info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: failOn of
                          the configuration, else error)
--explain                 show the rule, the public sources and the tool's own choice behind each finding
--print-defaults          print the built-in configuration and exit
--help                    show the usage
--version                 show the version
```

Name up to 100 manifests and folders; a folder gives its files named AppxManifest.xml or ending with .appxmanifest.
The paths in the report are relative to the folder you run the command in, with forward slashes on every system,
followed by the line.

The report of the messy example starts with what was read, the root, the certificate subject, the configuration, the
rules and the findings in one line each; then every manifest with its name, version, architecture, builds and counts;
then a summary of each manifest; then the count of findings of every rule; then the findings, errors first, each with
what to change:

```
msix-manifest-check: examples/messy/Package.appxmanifest
input: 0 folders and 1 file named; 1 manifest; 0 other files passed over; 0 folders inside passed over; 0 links not followed
root: examples/messy; the asset files the manifests name are looked for under it
certificate subject: CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB
config: examples/config.json (Brindlecote release review): minimum build 10.0.17763.0; restricted capabilities allowed none; reserved protocols http, https, file, ftp, mailto, microsoft-edge, ms-* and brindlecote-admin; minimum severity info; fail on error
rules: missing-identity (error); invalid-version (error); invalid-architecture (error); invalid-publisher (error); publisher-mismatch (error); missing-target-device-family (error); invalid-target-version (error); min-version-below-floor (warning); restricted-capability (warning); general-capability (info); missing-properties (error); missing-asset (warning); invalid-application (error); duplicate-application-id (error); missing-visual-elements (error); invalid-association (error); reserved-protocol (error); extension-listed (info); missing-resource-language (error); invalid-language-tag (warning); unreadable-manifest (error); scan-limit (error)
findings: 20 (8 error, 6 warning, 6 info)

Manifests (1)

  manifest                             name                version      architecture  min build  max tested  error  warning  info
  examples/messy/Package.appxmanifest  Brindlecote.Ledger  4.2.70000.0  x64           16299      22621       8      6        6

Summary

  examples/messy/Package.appxmanifest
    identity: Brindlecote.Ledger; publisher CN=Brindlecote Software, O=Brindlecote Ltd, L=Leeds, C=GB
    version: 4.2.70000.0; architecture x64; display name Brindlecote Ledger
    Windows: Windows.Desktop MinVersion 10.0.22631.0 (build 22631), MaxVersionTested 10.0.19045.0 (build 19045)
    Windows: Windows.Universal MinVersion 10.0.16299.0 (build 16299), MaxVersionTested 10.0.22621.0 (build 22621)
    capabilities: restricted runFullTrust, broadFileSystemAccess; general internetClientServer, privateNetworkClientServer; device webcam, microphone, location; custom none
    applications: App (Ledger.exe), App (LedgerSync.exe)
    extensions: protocol ms-ledger, file types Ledger Book, windows.startupTask
    languages: en-GB, en_IE

Rules (22)

  rule                          level    findings
  missing-identity              error    0
  invalid-version               error    1
  invalid-architecture          error    0
  invalid-publisher             error    0
  publisher-mismatch            error    1
  missing-target-device-family  error    0
  invalid-target-version        error    1
  min-version-below-floor       warning  1
  restricted-capability         warning  2
  general-capability            info     5
  missing-properties            error    0
  missing-asset                 warning  2
  invalid-application           error    1
  duplicate-application-id      error    1
  missing-visual-elements       error    1
  invalid-association           error    1
  reserved-protocol             error    1
  extension-listed              info     1
  missing-resource-language     error    0
  invalid-language-tag          warning  1
  unreadable-manifest           error    0
  scan-limit                    error    0

Findings (20)

  ERROR    publisher-mismatch            examples/messy/Package.appxmanifest:12
           the Publisher "CN=Brindlecote Software, O=Brindlecote Ltd, L=Leeds, C=GB" is not the certificate subject "CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB": the CN is "Brindlecote Software" in the manifest and "Brindlecote Software Ltd" in the certificate subject; signing with that certificate fails
           fix: set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names

  ERROR    invalid-version               examples/messy/Package.appxmanifest:13
           the Version "4.2.70000.0" is not four 16-bit numbers: 70000 is above 65535, the largest 16-bit part
           fix: write the version as four numbers from 0 to 65535, such as 1.4.2.0; a build number of a pipeline above 65535 does not fit

  ERROR    invalid-target-version        examples/messy/Package.appxmanifest:23
           the MinVersion 10.0.22631.0 of Windows.Desktop is above its MaxVersionTested 10.0.19045.0: the app would install only on builds it was never tested on
           fix: write both versions as 10.0.build.0, with MinVersion at or below MaxVersionTested

  ERROR    reserved-protocol             examples/messy/Package.appxmanifest:42
           the protocol "ms-ledger" of the application "App" is reserved (ms-*): Windows or the web already handles that scheme, so the registration competes with it for every link
           fix: use a scheme of the app's own, such as contoso-notes; to open web links, let the default browser handle them

  ERROR    invalid-association           examples/messy/Package.appxmanifest:47
           the file type association name "Ledger Book" of the application "App" is not valid: it is not all lowercase
           fix: name the protocol with a lowercase scheme of its own, such as contoso-notes, and the file type association with a lowercase name; write each FileType as .ext

  ERROR    invalid-application           examples/messy/Package.appxmanifest:58
           the application "App" has an Executable but no EntryPoint and no uap10:RuntimeBehavior, so Windows does not know how to activate it
           fix: give the application its Id and Executable, and EntryPoint="Windows.FullTrustApplication" for a desktop app (or uap10:RuntimeBehavior and uap10:TrustLevel)

  ERROR    duplicate-application-id      examples/messy/Package.appxmanifest:58
           the Id "App" is already used by the application at line 33; each application of a package needs an Id of its own
           fix: give each application of the package an Id of its own, and keep the Id of a published app as it is, because the Start tile follows it

  ERROR    missing-visual-elements       examples/messy/Package.appxmanifest:59
           the uap:VisualElements of the application "App" has no Description
           fix: give uap:VisualElements its DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo

  WARNING  min-version-below-floor       examples/messy/Package.appxmanifest:24
           the MinVersion 10.0.16299.0 of Windows.Universal (build 16299) is below the floor 10.0.17763.0 (build 17763), so the package installs on builds the team may not test or Microsoft may no longer service
           fix: raise MinVersion to a build the app is tested on and Microsoft still services, or lower minBuildFloor when the team supports the older build on purpose

  WARNING  invalid-language-tag          examples/messy/Package.appxmanifest:29
           the Language "en_IE" is not a well-formed BCP 47 tag: it holds a character other than letters, digits and hyphens; BCP 47 separates subtags with a hyphen
           fix: write the language as a BCP 47 tag with hyphens, such as en-US, de-DE or zh-Hans-CN

  WARNING  missing-asset                 examples/messy/Package.appxmanifest:39
           the path "Assets\Square44x44Logo.png" (the Square44x44Logo of the application "App") is not under the root examples/messy: Assets holds no Square44x44Logo.png, with or without qualifiers such as .scale-200
           fix: add the image to the package under that path, in at least one scale, or correct the path in the manifest

  WARNING  missing-asset                 examples/messy/Package.appxmanifest:63
           the path "Assets\Square44x44Logo.png" (the Square44x44Logo of the application "App") is not under the root examples/messy: Assets holds no Square44x44Logo.png, with or without qualifiers such as .scale-200
           fix: add the image to the package under that path, in at least one scale, or correct the path in the manifest

  WARNING  restricted-capability         examples/messy/Package.appxmanifest:70
           runFullTrust is a restricted capability: the package holds full-trust code, such as a packaged desktop app, that runs at medium integrity outside the app container; a Store submission must say why the app needs it, and the Store may refuse it
           fix: remove the capability when the app does not need it; otherwise write down why the app needs it for the Store submission, and add it to allowedRestrictedCapabilities once it is approved

  WARNING  restricted-capability         examples/messy/Package.appxmanifest:71
           broadFileSystemAccess is a restricted capability: the app can reach every file the signed-in user can, with no file picker; the Store asks why the pickers and the future access list are not enough; a Store submission must say why the app needs it, and the Store may refuse it
           fix: remove the capability when the app does not need it; otherwise write down why the app needs it for the Store submission, and add it to allowedRestrictedCapabilities once it is approved

  INFO     extension-listed              examples/messy/Package.appxmanifest:53
           the application "App" declares a startup task: an executable that starts when the user signs in, unless the user turns it off (LedgerAgent.exe)
           fix: keep the extension when the app needs it, and make sure the release notes and the Store listing say what it does

  INFO     general-capability            examples/messy/Package.appxmanifest:68
           internetClientServer is a general-use capability: incoming connections from the internet as well as outgoing ones, so the app can act as a server
           fix: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off

  INFO     general-capability            examples/messy/Package.appxmanifest:69
           privateNetworkClientServer is a general-use capability: incoming and outgoing connections on home and work networks, through the firewall
           fix: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off

  INFO     general-capability            examples/messy/Package.appxmanifest:72
           webcam is a device capability: the video feed of the camera; users can turn the access off in the privacy settings
           fix: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off

  INFO     general-capability            examples/messy/Package.appxmanifest:73
           microphone is a device capability: the audio feed of the microphone; users can turn the access off in the privacy settings
           fix: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off

  INFO     general-capability            examples/messy/Package.appxmanifest:74
           location is a device capability: the location of the device from GPS or the network; users can turn location off
           fix: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off

note: 5 asset paths looked for under examples/messy

This check reads the manifest and the asset files beside it on disk and fetches nothing. A finding is a lead with a file and a line, and a clean result is not a signature verification and not a Store certification (docs/limits.md).

RESULT: FAIL - 8 findings at or above error (8 error, 6 warning, 6 info)
```

With `--explain`, each finding also shows the rule, the points of the public pages it rests on and the tool's own
choice:

```
  ERROR    publisher-mismatch            examples/messy/Package.appxmanifest:12
           the Publisher "CN=Brindlecote Software, O=Brindlecote Ltd, L=Leeds, C=GB" is not the certificate subject "CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB": the CN is "Brindlecote Software" in the manifest and "Brindlecote Software Ltd" in the certificate subject; signing with that certificate fails
           fix: set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names
           rule: an Identity Publisher that differs from the subject given with --cert-subject
           basis: the Publisher must match the publisher subject of the certificate the package is signed with (Identity (manifest schema, Microsoft Learn), https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-identity)
           basis: the Subject of the signing certificate must match the Publisher of the manifest, a distinguished name such as CN=..., O=..., C=... (Create a certificate for package signing (MSIX, Microsoft Learn), https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing)
           basis: every MSIX package must be signed before it is installed, and Windows reads the manifest to deploy, show and update the app (What is MSIX? (Microsoft Learn), https://learn.microsoft.com/en-us/windows/msix/overview)
           the tool's own choice: only with --cert-subject: Identity Publisher against the subject given, compared as text, exactly; the message says which part differs, or that only the spacing or the order differs, because signing fails either way
```

The clean example passes:

```
msix-manifest-check: examples/clean/Package.appxmanifest
input: 0 folders and 1 file named; 1 manifest; 0 other files passed over; 0 folders inside passed over; 0 links not followed
root: examples/clean; the asset files the manifests name are looked for under it
certificate subject: CN=Oakhollow Labs, O=Oakhollow Labs Ltd, L=Galway, C=IE
config: built-in defaults: minimum build 10.0.17763.0; restricted capabilities allowed none; reserved protocols http, https, file, ftp, mailto, microsoft-edge and ms-*; minimum severity info; fail on error
rules: missing-identity (error); invalid-version (error); invalid-architecture (error); invalid-publisher (error); publisher-mismatch (error); missing-target-device-family (error); invalid-target-version (error); min-version-below-floor (warning); restricted-capability (warning); general-capability (info); missing-properties (error); missing-asset (warning); invalid-application (error); duplicate-application-id (error); missing-visual-elements (error); invalid-association (error); reserved-protocol (error); extension-listed (info); missing-resource-language (error); invalid-language-tag (warning); unreadable-manifest (error); scan-limit (error)
findings: 0

Manifests (1)

  manifest                             name             version   architecture  min build  max tested  error  warning  info
  examples/clean/Package.appxmanifest  Oakhollow.Notes  2.6.14.0  x64           19041      22621       0      0        0

Summary

  examples/clean/Package.appxmanifest
    identity: Oakhollow.Notes; publisher CN=Oakhollow Labs, O=Oakhollow Labs Ltd, L=Galway, C=IE
    version: 2.6.14.0; architecture x64; display name Oakhollow Notes
    Windows: Windows.Desktop MinVersion 10.0.19041.0 (build 19041), MaxVersionTested 10.0.22621.0 (build 22621)
    capabilities: restricted none; general none; device none; custom none
    applications: Notes (OakhollowNotes.exe)
    extensions: protocol oakhollow-notes, file types oaknote
    languages: en-US, de-DE, zh-Hans-CN

Rules (22)

  rule                          level    findings
  missing-identity              error    0
  invalid-version               error    0
  invalid-architecture          error    0
  invalid-publisher             error    0
  publisher-mismatch            error    0
  missing-target-device-family  error    0
  invalid-target-version        error    0
  min-version-below-floor       warning  0
  restricted-capability         warning  0
  general-capability            info     0
  missing-properties            error    0
  missing-asset                 warning  0
  invalid-application           error    0
  duplicate-application-id      error    0
  missing-visual-elements       error    0
  invalid-association           error    0
  reserved-protocol             error    0
  extension-listed              info     0
  missing-resource-language     error    0
  invalid-language-tag          warning  0
  unreadable-manifest           error    0
  scan-limit                    error    0

Findings (0)

  none

note: 5 asset paths looked for under examples/clean

This check reads the manifest and the asset files beside it on disk and fetches nothing. A finding is a lead with a file and a line, and a clean result is not a signature verification and not a Store certification (docs/limits.md).

RESULT: PASS - no finding at or above error
```

## How the manifest is read

1. A folder is listed at its top only, in the order of the names; a folder inside it is counted and passed over, and a
   symbolic link is counted and never followed. A file named is read as a manifest whatever its name.
2. The manifest is decoded by its byte order mark (UTF-8 with or without one, UTF-16 with one) and read by a small XML
   reader of its own that refuses every DOCTYPE and ENTITY declaration and resolves each prefix to its namespace URI.
3. The root must be Package of the foundation namespace. Identity, Properties, Dependencies, Resources, Capabilities
   and Applications are read below it, each element found by its local name and the family of its namespace URI.
4. With `--cert-subject`, the Publisher is compared with the subject; with `--root`, every logo path is looked for under
   the root, plain or with qualifiers.

[docs/method.md](docs/method.md) gives the details, and
[decision 2](docs/decisions/0002-read-the-manifest-with-a-small-reader-that-knows-namespaces.md) says why the reader is
the tool's own.

## What it reports

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `missing-identity` | `rules.missingIdentity` | error | no Identity, or one with no Name, Publisher or Version |
| `invalid-version` | `rules.invalidVersion` | error | an Identity Version that is not four parts of 0 to 65535 |
| `invalid-architecture` | `rules.invalidArchitecture` | error | a ProcessorArchitecture that is not x86, x64, arm, arm64, x86a64 or neutral |
| `invalid-publisher` | `rules.invalidPublisher` | error | a Publisher that is not a distinguished name with a CN |
| `publisher-mismatch` | `rules.publisherMismatch` | error | a Publisher that is not exactly the `--cert-subject`, with the part that differs |
| `missing-target-device-family` | `rules.missingTargetDeviceFamily` | error | no TargetDeviceFamily, or one with no Name, MinVersion or MaxVersionTested |
| `invalid-target-version` | `rules.invalidTargetVersion` | error | a MinVersion or MaxVersionTested that is not a quad version, or a MinVersion above MaxVersionTested |
| `min-version-below-floor` | `rules.minVersionBelowFloor` | warning | a MinVersion below `minBuildFloor` |
| `restricted-capability` | `rules.restrictedCapability` | warning | a restricted capability that needs a justification at Store submission |
| `general-capability` | `rules.generalCapability` | info | a general-use, device or custom capability, listed for review |
| `missing-properties` | `rules.missingProperties` | error | Properties with no DisplayName, PublisherDisplayName or Logo |
| `missing-asset` | `rules.missingAsset` | warning | a logo or image path with no file under `--root`, plain or with qualifiers |
| `invalid-application` | `rules.invalidApplication` | error | an Application with no Id, no Executable, or no EntryPoint where one is needed |
| `duplicate-application-id` | `rules.duplicateApplicationId` | error | an Application Id used twice |
| `missing-visual-elements` | `rules.missingVisualElements` | error | uap:VisualElements missing, or with a required attribute missing |
| `invalid-association` | `rules.invalidAssociation` | error | a protocol or file type name, or a file type, that is not valid |
| `reserved-protocol` | `rules.reservedProtocol` | error | a protocol named like a scheme Windows or the web already handles |
| `extension-listed` | `rules.extensionListed` | info | a startup task, full-trust process, app service, COM server, alias or firewall rule |
| `missing-resource-language` | `rules.missingResourceLanguage` | error | no Resource Language |
| `invalid-language-tag` | `rules.invalidLanguageTag` | warning | a Resource Language that is not a well-formed BCP 47 tag |
| `unreadable-manifest` | none | error | a file that cannot be read as a package manifest |
| `scan-limit` | none | error | input past the limits of a run |

The two rules of input problems are always errors. [docs/method.md](docs/method.md) says exactly what each rule looks
at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the points of the public
pages each rule rests on.

## The root and the certificate subject

| Option | What is compared |
| --- | --- |
| `--root <folder>` | each logo and image path of the manifest (the Logo of Properties, the logos of VisualElements, its DefaultTile, SplashScreen and LockScreen, and the logos of protocols and file types), looked for under the folder with the case of names ignored; `Logo.scale-200.png`, `Logo.targetsize-48_altform-unplated.png` and `scale-200/Logo.png` count for `Logo.png` |
| `--cert-subject "<CN=...>"` | the Publisher of Identity against the subject of the signing certificate, as text, exactly; the subject must be a distinguished name with a CN |

Without either option, that check does not run and the report says so in a note
([decision 3](docs/decisions/0003-check-the-files-on-disk-and-fetch-nothing.md)). In a pipeline, read the subject from
the certificate the signing step uses and pass it in.

## Namespaces

A manifest binds its own prefixes to fixed namespace URIs. The tool reads the URI, never the prefix:

| Family | Namespace URI | Usual prefixes |
| --- | --- | --- |
| foundation | `http://schemas.microsoft.com/appx/manifest/foundation/windows10` | none (the default namespace) |
| uap | `http://schemas.microsoft.com/appx/manifest/uap/windows10`, and the same with `/2` to `/17` | `uap`, `uap2` to `uap17` |
| rescap | `http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities`, and with `/3` and `/6` | `rescap`, `rescap3`, `rescap6` |
| desktop | `http://schemas.microsoft.com/appx/manifest/desktop/windows10`, and with `/2` to `/11` | `desktop`, `desktop2` to `desktop11` |
| com | `http://schemas.microsoft.com/appx/manifest/com/windows10` | `com` |

The full table is one data file, src/namespaces.js, listed in [docs/inputs.md](docs/inputs.md). A restricted
capability written as `<restricted:Capability>` with `restricted` bound to the rescap URI is found; a
`<rescap:Capability>` whose prefix is bound to the uap URI is a general capability.

## What is not checked

The tool reads the files it is given and never guesses. It does not:

- open a certificate, so it does not see whether the certificate with the subject given exists, is trusted or expires;
- call the Store or Partner Center, so it does not know whether the name is reserved or a capability will be approved;
- validate the whole schema, which MakeAppx does when it builds the package; only the parts of docs/method.md are read;
- open the images, so their size, format and scale are not checked;
- check a language tag against the IANA registry, only its form;
- read a date or the clock, so a build that falls out of servicing is caught only once `minBuildFloor` is raised;
- decide whether a package is safe to ship: it is not a signature verification and not a Store certification.

So a clean run means the manifest holds none of the problems the rules look for, and every report says so.

## The configuration file

```json
{
  "name": "Brindlecote release review",
  "minBuildFloor": "10.0.17763.0",
  "allowedRestrictedCapabilities": [],
  "reservedProtocols": ["http", "https", "file", "ftp", "mailto", "microsoft-edge", "ms-*", "brindlecote-admin"]
}
```

Every key is optional, and without `--config` the defaults apply. `rules` sets the level of each rule (`info`,
`warning`, `error` or `off`); `minBuildFloor` is the lowest MinVersion build a manifest should name, `10.0.17763.0` by
default, a build number and never a date; `allowedRestrictedCapabilities` lists the restricted capabilities the team has
a justification for, none by default; `reservedProtocols` lists the protocol names an app should not register,
`http`, `https`, `file`, `ftp`, `mailto`, `microsoft-edge` and `ms-*` by default, where `*` ends a prefix;
`minSeverity` sets the lowest level shown and `failOn` the lowest level that fails the run. A key the tool does not know
is an error with its line and a suggestion, and a key named twice is refused. [docs/inputs.md](docs/inputs.md)
describes every key and how the default build floor was chosen, and `--print-defaults` writes the whole default
configuration out.

## Formats

- `text`: for a terminal: what was read, the root, the certificate subject, the configuration, the rules, the manifests
  with their name, version, architecture, builds and counts, a summary of each manifest, the count of every rule, the
  findings with the file and line and what to change, the notes, the notice and the result. With `--explain` also the
  rule, the points of the public pages and the tool's own choice behind each finding.
- `json` (or `--json`): the whole report: the input, the configuration, the manifests with their summary and encoding,
  the counts per rule, every finding with its file, line and column, the totals, the result, the notes and the notice.
- `csv`: one record per finding, ready for a sheet: the level, the rule, the file, the line, the column, what was found
  and what to change, with CRLF line ends as RFC 4180 writes. A field that a spreadsheet could read as a formula gets a
  single quote in front. The start of the messy example:

```
level,rule,file,line,column,found,fix
error,publisher-mismatch,examples/messy/Package.appxmanifest,12,16,"the Publisher ""CN=Brindlecote Software, O=Brindlecote Ltd, L=Leeds, C=GB"" is not the certificate subject ""CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB"": the CN is ""Brindlecote Software"" in the manifest and ""Brindlecote Software Ltd"" in the certificate subject; signing with that certificate fails","set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names"
error,invalid-version,examples/messy/Package.appxmanifest,13,14,"the Version ""4.2.70000.0"" is not four 16-bit numbers: 70000 is above 65535, the largest 16-bit part","write the version as four numbers from 0 to 65535, such as 1.4.2.0; a build number of a pipeline above 65535 does not fit"
error,invalid-target-version,examples/messy/Package.appxmanifest,23,60,the MinVersion 10.0.22631.0 of Windows.Desktop is above its MaxVersionTested 10.0.19045.0: the app would install only on builds it was never tested on,"write both versions as 10.0.build.0, with MinVersion at or below MaxVersionTested"
```

- `github`: one workflow command per finding, `::error`, `::warning` or `::notice` (for info) with the file, line and
  column, which GitHub shows as an annotation in the pull request, then a summary line. The characters a command gives
  a meaning to are escaped. Two findings of the messy example:

```
::error file=examples/messy/Package.appxmanifest,line=12,col=16,title=msix-manifest-check publisher-mismatch::the Publisher "CN=Brindlecote Software, O=Brindlecote Ltd, L=Leeds, C=GB" is not the certificate subject "CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB": the CN is "Brindlecote Software" in the manifest and "Brindlecote Software Ltd" in the certificate subject; signing with that certificate fails; fix: set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names
::error file=examples/messy/Package.appxmanifest,line=42,col=31,title=msix-manifest-check reserved-protocol::the protocol "ms-ledger" of the application "App" is reserved (ms-*): Windows or the web already handles that scheme, so the registration competes with it for every link; fix: use a scheme of the app's own, such as contoso-notes; to open web links, let the default browser handle them
```

## Exit codes

`0`: no finding at or above the fail-on level (`error` by default). `1`: at least one finding at or above it; with the
default, an identity, version, architecture or publisher that is not valid, a publisher that is not the certificate
subject, device family versions that are missing, not valid or in the wrong order, properties or visual elements with
a part missing, an application that cannot start or shares an Id, an invalid or reserved protocol or file type name, a
missing language, or a manifest the tool could not read; with `--fail-on warning`, a build below the floor, a
restricted capability, a missing logo and a language tag that is not well formed too. `2`: a usage or input error:
nothing named, an unknown option, an option given twice, `--explain` with the csv or github format, a URL in place of a
path, a path that cannot be read, a symbolic link, a path named twice, a `--root` that is not a folder, a
`--cert-subject` that is not a distinguished name, or a configuration with an unknown key, a key named twice or a value
of the wrong kind. With exit code `2` the tool gives no result and prints the problems on standard error.

## Limits

The tool reads files; it fetches nothing and connects to nothing. A run reports the problems of docs/method.md that the
manifest holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 2 MB for a manifest,
20,000 elements nested up to 64 deep, 10,000 entries in a folder, 200 manifests, 500 asset paths of a manifest, 500
findings listed per rule. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading manifests from a pull
request and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool
in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration, lists the folders, reads each manifest, looks for its assets under the root, and builds the report of the run |
| `src/walk.js`, `src/files.js` | the listing of the top of a folder with no link followed, and the bounded reading of files by their byte order mark |
| `src/xml.js`, `src/namespaces.js` | the XML reader with namespaces and no DTD, and the data file of namespace URIs and their families |
| `src/manifest.js` | the checks of one manifest and its summary |
| `src/assets.js` | the lookup of logo paths under the root, with qualifiers |
| `src/versions.js`, `src/publisher.js`, `src/languages.js` | quad versions, distinguished names and BCP 47 language tags |
| `src/capabilities.js` | the groups of capabilities and what each capability and extension implies |
| `src/config.js`, `src/defaults.js`, `src/json.js` | the configuration file over the defaults, read as strict JSON |
| `src/rules.js` | the rules, their levels and the result |
| `src/report.js`, `src/csv.js`, `src/text.js`, `src/size.js`, `src/words.js` | the text, JSON, CSV and GitHub output, the cleaning of text from the input, number formats and compared words |
| `src/data.js` | the public pages and the points the rules rest on, in this project's own words |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| The manifest, what it holds, and that it is signed with the package | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/appx-package-manifest |
| The children of Package and the language every package declares | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-package |
| Name, Publisher, Version in quad notation and ProcessorArchitecture | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-identity |
| DisplayName, PublisherDisplayName and Logo | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-properties |
| TargetDeviceFamily, MinVersion and MaxVersionTested | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-targetdevicefamily |
| Application Id, Executable, EntryPoint and the activation attributes | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-application |
| The required attributes of uap:VisualElements and logo scales | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-visualelements |
| The capability elements | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-capabilities |
| Resource Language as a BCP 47 tag | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-resource |
| Protocol names | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol |
| File type association names | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-filetypeassociation |
| App services | Microsoft Learn, https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap3-appservice |
| General, device, restricted and custom capabilities, and Store approval | Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/app-capability-declarations |
| What an MSIX package is and that it must be signed | Microsoft Learn, https://learn.microsoft.com/en-us/windows/msix/overview |
| The certificate subject must match the Publisher | Microsoft Learn, https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing |
| Signing a package with SignTool | Microsoft Learn, https://learn.microsoft.com/en-us/windows/msix/package/sign-app-package-using-signtool |
| Packaging a desktop app | Microsoft Learn, https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-packaging-dot-net |
| Startup tasks, full-trust processes, COM servers and other extensions | Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions |
| Protocol names in lowercase | Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/develop/launch/handle-uri-activation |
| The schemes Windows handles itself | Microsoft Learn, https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-default-app |
| Qualifiers such as scale-200 in file and folder names | Microsoft Learn, https://learn.microsoft.com/en-us/windows/uwp/app-resources/tailor-resources-lang-scale-contrast |
| The Windows builds still serviced | Microsoft Learn, https://learn.microsoft.com/en-us/windows/release-health/release-information |
| Language tags | BCP 47, https://www.rfc-editor.org/info/bcp47, and RFC 5646, https://www.rfc-editor.org/rfc/rfc5646 |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object, and UTF-8 | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| Formulas hidden in CSV files | OWASP, https://community.owasp.org/attacks/CSV_Injection |
| Refusing DOCTYPE against XML external entities | OWASP, https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html |
| Annotations from workflow commands | GitHub Docs, https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |

[research/sources.md](research/sources.md) has a note on each page, in this project's own words.

## Background

A Windows app packaged with MSIX carries one XML file that decides whether the package can be signed, whether the
Store takes it and how Windows installs it. A publisher copied from an old certificate, a build number that does not
fit in a version, a capability added for a test and never removed: each is one line of that file, visible before the
build if someone reads it with them in mind on every release. How such apps are built, packaged and signed is
described on the page
[Windows App Development Services](https://innerluxes.dev/application/development/desktop/windows).

## License

MIT
