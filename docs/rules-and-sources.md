# Rules and sources

Every rule rests on points of public pages, written in this project's own words; this document lists them, with the
choices that are the tool's own and what to change before the release goes out. The same points are in src/data.js
and are shown by `--explain`; research/sources.md has a longer note on each page. The tool reads the manifest and the
asset files on disk: a point says what a page says, and a finding says what a file holds. A clean result is not a
signature verification and not a Store certification.

## The rules

| Rule | Default level | Points |
| --- | --- | --- |
| `missing-identity` | error | `identityFields`, `packageChildren` |
| `invalid-version` | error | `identityFields` |
| `invalid-architecture` | error | `identityFields` |
| `invalid-publisher` | error | `identityPublisher`, `certSubject` |
| `publisher-mismatch` | error | `identityPublisher`, `certSubject`, `msixSigned` |
| `missing-target-device-family` | error | `tdfFields`, `packageChildren` |
| `invalid-target-version` | error | `tdfFields`, `tdfMeaning` |
| `min-version-below-floor` | warning | `tdfMeaning`, `servicedBuilds` |
| `restricted-capability` | warning | `restrictedApproval`, `capabilityGroups` |
| `general-capability` | info | `capabilityGroups`, `capabilityList` |
| `missing-properties` | error | `propertiesFields`, `packageChildren` |
| `missing-asset` | warning | `propertiesFields`, `visualElementsScales`, `qualifiedNames` |
| `invalid-application` | error | `applicationFields`, `applicationActivation` |
| `duplicate-application-id` | error | `applicationFields` |
| `missing-visual-elements` | error | `visualElementsFields` |
| `invalid-association` | error | `protocolName`, `protocolLowercase`, `fileTypeName` |
| `reserved-protocol` | error | `builtInSchemes`, `protocolLowercase` |
| `extension-listed` | info | `extensionsDesktop`, `appService` |
| `missing-resource-language` | error | `packageLanguage`, `resourceLanguage` |
| `invalid-language-tag` | warning | `resourceLanguage`, `langTagSyntax` |
| `unreadable-manifest` | error, always | `xxeDoctype`, `manifestSigned` |
| `scan-limit` | error, always | `xxeDoctype` |

### `missing-identity`

The package has no identity, or one with a part missing.

- `identityFields` (Identity (manifest schema, Microsoft Learn)): Name, Publisher and Version are required; Version is in quad notation, major.minor.build.revision; ProcessorArchitecture is x86, x64, arm, arm64, x86a64 or neutral, and a package with executable code has it.
- `packageChildren` (Package (manifest schema, Microsoft Learn)): Package holds Identity, Properties and Dependencies, and may hold Resources, Capabilities, Extensions and Applications.

The tool's own choice: a manifest with no Identity element in the foundation namespace, and an Identity with no Name, Publisher or Version, or one that is empty.

What to change: give Identity its Name, Publisher and Version; for the Store, take the Name and Publisher that Partner Center reserved for the app.

### `invalid-version`

The version of the package is not four 16-bit numbers.

- `identityFields` (Identity (manifest schema, Microsoft Learn)): Name, Publisher and Version are required; Version is in quad notation, major.minor.build.revision; ProcessorArchitecture is x86, x64, arm, arm64, x86a64 or neutral, and a package with executable code has it.

The tool's own choice: Identity Version that is not four whole numbers separated by dots, each from 0 to 65535 with no leading zero; the version of a .NET or C++ project often has three parts, or a build number above 65535.

What to change: write the version as four numbers from 0 to 65535, such as 1.4.2.0; a build number of a pipeline above 65535 does not fit.

### `invalid-architecture`

The processor architecture is not one Windows knows.

- `identityFields` (Identity (manifest schema, Microsoft Learn)): Name, Publisher and Version are required; Version is in quad notation, major.minor.build.revision; ProcessorArchitecture is x86, x64, arm, arm64, x86a64 or neutral, and a package with executable code has it.

The tool's own choice: a ProcessorArchitecture other than x86, x64, arm, arm64, x86a64 or neutral, compared with its case, as the schema compares the values of a list; an Identity with no ProcessorArchitecture is not reported, because a package with no code may leave it out.

What to change: write one of x86, x64, arm, arm64, x86a64 or neutral, in lowercase.

### `invalid-publisher`

The publisher is not a distinguished name.

- `identityPublisher` (Identity (manifest schema, Microsoft Learn)): the Publisher must match the publisher subject of the certificate the package is signed with.
- `certSubject` (Create a certificate for package signing (MSIX, Microsoft Learn)): the Subject of the signing certificate must match the Publisher of the manifest, a distinguished name such as CN=..., O=..., C=....

The tool's own choice: a Publisher that is not TYPE=value parts separated by commas, with a CN among them; a value with a comma, a quote or an equals sign must be in double quotes or escaped.

What to change: copy the subject of the signing certificate into Publisher, such as CN=Contoso Software, O=Contoso Corporation, C=US.

### `publisher-mismatch`

The publisher is not the subject of the signing certificate.

- `identityPublisher` (Identity (manifest schema, Microsoft Learn)): the Publisher must match the publisher subject of the certificate the package is signed with.
- `certSubject` (Create a certificate for package signing (MSIX, Microsoft Learn)): the Subject of the signing certificate must match the Publisher of the manifest, a distinguished name such as CN=..., O=..., C=....
- `msixSigned` (What is MSIX? (Microsoft Learn)): every MSIX package must be signed before it is installed, and Windows reads the manifest to deploy, show and update the app.

The tool's own choice: only with --cert-subject: Identity Publisher against the subject given, compared as text, exactly; the message says which part differs, or that only the spacing or the order differs, because signing fails either way.

What to change: set Publisher to the exact subject of the certificate that signs the package, or sign with the certificate whose subject the manifest names.

### `missing-target-device-family`

The package names no device family to target.

- `tdfFields` (TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)): TargetDeviceFamily needs Name, MinVersion and MaxVersionTested, and both versions are in quad notation.
- `packageChildren` (Package (manifest schema, Microsoft Learn)): Package holds Identity, Properties and Dependencies, and may hold Resources, Capabilities, Extensions and Applications.

The tool's own choice: a manifest with no Dependencies, a Dependencies with no TargetDeviceFamily, and a TargetDeviceFamily with no Name, MinVersion or MaxVersionTested.

What to change: add <TargetDeviceFamily Name="Windows.Desktop" MinVersion="..." MaxVersionTested="..."/> to Dependencies, with the builds the app supports and was tested on.

### `invalid-target-version`

A device family version is not valid, or MinVersion is above MaxVersionTested.

- `tdfFields` (TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)): TargetDeviceFamily needs Name, MinVersion and MaxVersionTested, and both versions are in quad notation.
- `tdfMeaning` (TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)): the app is not applicable on a system older than MinVersion, and MaxVersionTested is the newest version the app was tested against, which decides the behavior it gets.

The tool's own choice: a MinVersion or MaxVersionTested that is not four 16-bit numbers, and a MinVersion higher than the MaxVersionTested of the same TargetDeviceFamily, which says the app was never tested on a build it installs on.

What to change: write both versions as 10.0.build.0, with MinVersion at or below MaxVersionTested.

### `min-version-below-floor`

The package installs on builds older than the floor.

- `tdfMeaning` (TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)): the app is not applicable on a system older than MinVersion, and MaxVersionTested is the newest version the app was tested against, which decides the behavior it gets.
- `servicedBuilds` (Windows release information (Microsoft Learn)): Microsoft lists the Windows builds that are still serviced, with the end of servicing of each, and the list changes over time.

The tool's own choice: the tool's own choice: a MinVersion below minBuildFloor (10.0.17763.0 by default, a number in the configuration, never a date); the floor stands for the oldest build the team still supports and tests, and Microsoft's release information page lists the builds still serviced.

What to change: raise MinVersion to a build the app is tested on and Microsoft still services, or lower minBuildFloor when the team supports the older build on purpose.

### `restricted-capability`

A restricted capability needs a justification at Store submission.

- `restrictedApproval` (App capability declarations (Microsoft Learn)): restricted capabilities are for very specific scenarios; a Store submission that declares one must say why, and the testers approve it or fail the submission, while sideloading needs no approval.
- `capabilityGroups` (App capability declarations (Microsoft Learn)): capabilities are general-use, device, restricted or custom, and restricted ones are declared in the rescap namespace.

The tool's own choice: every Capability of the rescap namespace family, found by its namespace URI and not by its prefix, that is not in allowedRestrictedCapabilities; a sideloaded package needs no approval, so this is a warning and not an error.

What to change: remove the capability when the app does not need it; otherwise write down why the app needs it for the Store submission, and add it to allowedRestrictedCapabilities once it is approved.

### `general-capability`

A general-use, device or custom capability is declared.

- `capabilityGroups` (App capability declarations (Microsoft Learn)): capabilities are general-use, device, restricted or custom, and restricted ones are declared in the rescap namespace.
- `capabilityList` (Capabilities (manifest schema, Microsoft Learn)): Capabilities holds Capability elements of the foundation, uap and rescap namespaces, DeviceCapability and CustomCapability elements.

The tool's own choice: every Capability of the foundation or uap namespace family, every DeviceCapability and every CustomCapability, listed so that a reviewer sees what the app asks for; none of them is a problem by itself.

What to change: keep only the capabilities the app uses; privacy-sensitive ones (camera, microphone, location) need the app to work when the user turns them off.

### `missing-properties`

The package properties are missing a name or logo.

- `propertiesFields` (Properties (manifest schema, Microsoft Learn)): Properties needs DisplayName, PublisherDisplayName and Logo, the path to a file that holds an image.
- `packageChildren` (Package (manifest schema, Microsoft Learn)): Package holds Identity, Properties and Dependencies, and may hold Resources, Capabilities, Extensions and Applications.

The tool's own choice: a manifest with no Properties, and a Properties with no DisplayName, PublisherDisplayName or Logo, or with one that is empty.

What to change: add DisplayName, PublisherDisplayName and Logo to Properties; for the Store, use the names reserved in Partner Center.

### `missing-asset`

A logo or visual asset the manifest names is not on disk.

- `propertiesFields` (Properties (manifest schema, Microsoft Learn)): Properties needs DisplayName, PublisherDisplayName and Logo, the path to a file that holds an image.
- `visualElementsScales` (uap:VisualElements (manifest schema, Microsoft Learn)): the logos can be given in several scales, so that Windows picks the best image for the display.
- `qualifiedNames` (Tailor your resources for language, scale, high contrast, and other qualifiers (Microsoft Learn)): a qualifier such as scale-200 goes in the file name (logo.scale-200.png) or in a folder name (scale-200/logo.png), and a file with no qualifier is the neutral match.

The tool's own choice: only with --root: the Logo of Properties, the logos of uap:VisualElements, its DefaultTile, SplashScreen and LockScreen, and the logos of protocols and file types, looked for under the root by the path the manifest gives, with its case ignored as Windows does; a file with qualifiers in its name (Logo.scale-200.png, Logo.targetsize-48_altform-unplated.png) or in a folder of qualifiers (scale-200/Logo.png) counts; a path that leaves the root, a symbolic link and an ms-appx or other address are reported.

What to change: add the image to the package under that path, in at least one scale, or correct the path in the manifest.

### `invalid-application`

An application cannot be started as written.

- `applicationFields` (Application (manifest schema, Microsoft Learn)): Id is required and cannot be used twice in one package; Executable ends with .exe; without StartPage, both Executable and EntryPoint are given.
- `applicationActivation` (Application (manifest schema, Microsoft Learn)): uap10:RuntimeBehavior with uap10:TrustLevel can stand in for EntryPoint, and Windows.FullTrustApplication is the entry point of a full-trust desktop app.

The tool's own choice: an Application with no Id; with no StartPage and no Executable; with an Executable that does not end with .exe; and with an Executable but no StartPage, no EntryPoint and no uap10:RuntimeBehavior of packagedClassicApp or win32App.

What to change: give the application its Id and Executable, and EntryPoint="Windows.FullTrustApplication" for a desktop app (or uap10:RuntimeBehavior and uap10:TrustLevel).

### `duplicate-application-id`

Two applications of the package have the same Id.

- `applicationFields` (Application (manifest schema, Microsoft Learn)): Id is required and cannot be used twice in one package; Executable ends with .exe; without StartPage, both Executable and EntryPoint are given.

The tool's own choice: two Application elements with the same Id, compared with their case; the second one is reported, with the line of the first.

What to change: give each application of the package an Id of its own, and keep the Id of a published app as it is, because the Start tile follows it.

### `missing-visual-elements`

An application is missing the visual elements Windows shows.

- `visualElementsFields` (uap:VisualElements (manifest schema, Microsoft Learn)): uap:VisualElements needs DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo, and a logo is a .png, .jpg or .jpeg path.

The tool's own choice: an Application with no VisualElements of the uap namespace family, and a VisualElements with no DisplayName, Description, BackgroundColor, Square150x150Logo or Square44x44Logo, or with one that is empty; all that is missing is named in one finding.

What to change: give uap:VisualElements its DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo.

### `invalid-association`

A protocol or file type association has a name that is not valid.

- `protocolName` (uap:Protocol (manifest schema, Microsoft Learn)): the Name of uap:Protocol is the URI scheme, 2 to 2,048 characters, unique in the package.
- `protocolLowercase` (Handle URI activation with a Windows app (Microsoft Learn)): the scheme name must be all lowercase, an app should register a scheme only to handle all of it, and a new scheme name follows RFC 4395.
- `fileTypeName` (uap:FileTypeAssociation (manifest schema, Microsoft Learn)): the Name of uap:FileTypeAssociation is 1 to 64 characters, all lowercase, with no spaces.

The tool's own choice: a protocol Name that is not 2 to 2,048 characters, a lowercase letter followed by lowercase letters, digits, +, - or . (the form of a URI scheme); a protocol named twice in the package; a file type association Name that is not 1 to 64 lowercase characters with no space; and a FileType that does not start with a dot or holds a space.

What to change: name the protocol with a lowercase scheme of its own, such as contoso-notes, and the file type association with a lowercase name; write each FileType as .ext.

### `reserved-protocol`

A protocol takes a scheme that Windows or the web already handles.

- `builtInSchemes` (Launch the default Windows app for a URI (Microsoft Learn)): Windows comes with handlers for schemes such as http, https, mailto, ms-settings and ms-store, and the user picks the app that opens a scheme.
- `protocolLowercase` (Handle URI activation with a Windows app (Microsoft Learn)): the scheme name must be all lowercase, an app should register a scheme only to handle all of it, and a new scheme name follows RFC 4395.

The tool's own choice: the tool's own choice: a protocol Name in reservedProtocols (http, https, file, ftp, mailto, microsoft-edge and every name starting with ms- by default), compared without case; an app that registers one competes with the handlers of Windows for every link of that scheme.

What to change: use a scheme of the app's own, such as contoso-notes; to open web links, let the default browser handle them.

### `extension-listed`

An extension changes how the app runs with Windows.

- `extensionsDesktop` (Integrate your desktop app with Windows using packaging extensions (Microsoft Learn)): a packaged desktop app joins Windows through extensions, each the Category of an Extension element: protocols, file types, startup tasks, COM servers and more.
- `appService` (uap3:AppService (manifest schema, Microsoft Learn)): an app service lets other apps call a background task of this app by its service name.

The tool's own choice: every application extension of the category windows.startupTask, windows.fullTrustProcess, windows.appService, windows.comServer, windows.appExecutionAlias or windows.firewallRules, listed with what it implies so that a reviewer sees it.

What to change: keep the extension when the app needs it, and make sure the release notes and the Store listing say what it does.

### `missing-resource-language`

The package declares no language.

- `packageLanguage` (Package (manifest schema, Microsoft Learn)): every package must declare at least one language for its resources.
- `resourceLanguage` (Resource (manifest schema, Microsoft Learn)): the Language of a Resource is a BCP 47 language tag, and the first Resource names the default language.

The tool's own choice: a manifest with no Resources, or with no Resource that has a Language.

What to change: add <Resources><Resource Language="en-US"/></Resources>, or Language="x-generate" in Package.appxmanifest for Visual Studio to fill in.

### `invalid-language-tag`

A resource language is not a well-formed language tag.

- `resourceLanguage` (Resource (manifest schema, Microsoft Learn)): the Language of a Resource is a BCP 47 language tag, and the first Resource names the default language.
- `langTagSyntax` (RFC 5646, Tags for Identifying Languages): a tag is a language subtag with optional script, region, variant, extension and private use subtags after it, separated by hyphens, of at most eight characters each and compared without case.

The tool's own choice: a Resource Language that is not a well-formed BCP 47 tag: subtags of letters and digits separated by hyphens, in the order language, script, region, variants, extensions and private use; whether a subtag is in the IANA registry is not checked.

What to change: write the language as a BCP 47 tag with hyphens, such as en-US, de-DE or zh-Hans-CN.

### `unreadable-manifest`

A manifest that cannot be read.

- `xxeDoctype` (XML External Entity Prevention Cheat Sheet (OWASP)): the safest defence against XML external entities is to refuse DOCTYPE declarations, which also stops entity expansion that exhausts memory.
- `manifestSigned` (App package manifest (schema reference, Microsoft Learn)): every app package holds one manifest with its identity, dependencies, capabilities, visual elements and extension points, and the manifest is signed with the package, so it cannot change after signing.

The tool's own choice: a file over its size limit, a binary file, a file that is not valid UTF-8 or UTF-16 with its byte order mark, XML that is not well formed or that has a DOCTYPE or a declared entity, a prefix that is not declared, and a root element that is not Package of the foundation namespace; nothing in it is checked; this rule cannot be set lower or off.

What to change: save the manifest as UTF-8 or UTF-16 with its byte order mark, as well-formed XML with Package of the foundation namespace at its root.

### `scan-limit`

The input is larger than the limits of a run.

- `xxeDoctype` (XML External Entity Prevention Cheat Sheet (OWASP)): the safest defence against XML external entities is to refuse DOCTYPE declarations, which also stops entity expansion that exhausts memory.

The tool's own choice: a folder with more entries, or more manifests or asset references in all, than the limits of docs/limits.md; the rest is not read, so the run fails; this rule cannot be set lower or off.

What to change: check each package in its own run.

## The points

| Point | Page | What it says |
| --- | --- | --- |
| `manifestSigned` | App package manifest (schema reference, Microsoft Learn) | every app package holds one manifest with its identity, dependencies, capabilities, visual elements and extension points, and the manifest is signed with the package, so it cannot change after signing |
| `packageChildren` | Package (manifest schema, Microsoft Learn) | Package holds Identity, Properties and Dependencies, and may hold Resources, Capabilities, Extensions and Applications |
| `packageLanguage` | Package (manifest schema, Microsoft Learn) | every package must declare at least one language for its resources |
| `identityFields` | Identity (manifest schema, Microsoft Learn) | Name, Publisher and Version are required; Version is in quad notation, major.minor.build.revision; ProcessorArchitecture is x86, x64, arm, arm64, x86a64 or neutral, and a package with executable code has it |
| `identityPublisher` | Identity (manifest schema, Microsoft Learn) | the Publisher must match the publisher subject of the certificate the package is signed with |
| `certSubject` | Create a certificate for package signing (MSIX, Microsoft Learn) | the Subject of the signing certificate must match the Publisher of the manifest, a distinguished name such as CN=..., O=..., C=... |
| `signTool` | Sign an app package using SignTool (MSIX, Microsoft Learn) | a package is signed with SignTool and a certificate, with the hash algorithm the package was made with, before it goes to the Store |
| `msixSigned` | What is MSIX? (Microsoft Learn) | every MSIX package must be signed before it is installed, and Windows reads the manifest to deploy, show and update the app |
| `propertiesFields` | Properties (manifest schema, Microsoft Learn) | Properties needs DisplayName, PublisherDisplayName and Logo, the path to a file that holds an image |
| `tdfFields` | TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn) | TargetDeviceFamily needs Name, MinVersion and MaxVersionTested, and both versions are in quad notation |
| `tdfMeaning` | TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn) | the app is not applicable on a system older than MinVersion, and MaxVersionTested is the newest version the app was tested against, which decides the behavior it gets |
| `servicedBuilds` | Windows release information (Microsoft Learn) | Microsoft lists the Windows builds that are still serviced, with the end of servicing of each, and the list changes over time |
| `applicationFields` | Application (manifest schema, Microsoft Learn) | Id is required and cannot be used twice in one package; Executable ends with .exe; without StartPage, both Executable and EntryPoint are given |
| `applicationActivation` | Application (manifest schema, Microsoft Learn) | uap10:RuntimeBehavior with uap10:TrustLevel can stand in for EntryPoint, and Windows.FullTrustApplication is the entry point of a full-trust desktop app |
| `visualElementsFields` | uap:VisualElements (manifest schema, Microsoft Learn) | uap:VisualElements needs DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo, and a logo is a .png, .jpg or .jpeg path |
| `visualElementsScales` | uap:VisualElements (manifest schema, Microsoft Learn) | the logos can be given in several scales, so that Windows picks the best image for the display |
| `qualifiedNames` | Tailor your resources for language, scale, high contrast, and other qualifiers (Microsoft Learn) | a qualifier such as scale-200 goes in the file name (logo.scale-200.png) or in a folder name (scale-200/logo.png), and a file with no qualifier is the neutral match |
| `capabilityGroups` | App capability declarations (Microsoft Learn) | capabilities are general-use, device, restricted or custom, and restricted ones are declared in the rescap namespace |
| `restrictedApproval` | App capability declarations (Microsoft Learn) | restricted capabilities are for very specific scenarios; a Store submission that declares one must say why, and the testers approve it or fail the submission, while sideloading needs no approval |
| `capabilityList` | Capabilities (manifest schema, Microsoft Learn) | Capabilities holds Capability elements of the foundation, uap and rescap namespaces, DeviceCapability and CustomCapability elements |
| `packagedDesktop` | Package a desktop app from source code using Visual Studio (MSIX, Microsoft Learn) | a desktop app is packaged with a packaging project that writes the manifest, makes the visual assets and builds the package for the Store or for sideloading |
| `extensionsDesktop` | Integrate your desktop app with Windows using packaging extensions (Microsoft Learn) | a packaged desktop app joins Windows through extensions, each the Category of an Extension element: protocols, file types, startup tasks, COM servers and more |
| `appService` | uap3:AppService (manifest schema, Microsoft Learn) | an app service lets other apps call a background task of this app by its service name |
| `resourceLanguage` | Resource (manifest schema, Microsoft Learn) | the Language of a Resource is a BCP 47 language tag, and the first Resource names the default language |
| `protocolName` | uap:Protocol (manifest schema, Microsoft Learn) | the Name of uap:Protocol is the URI scheme, 2 to 2,048 characters, unique in the package |
| `protocolLowercase` | Handle URI activation with a Windows app (Microsoft Learn) | the scheme name must be all lowercase, an app should register a scheme only to handle all of it, and a new scheme name follows RFC 4395 |
| `builtInSchemes` | Launch the default Windows app for a URI (Microsoft Learn) | Windows comes with handlers for schemes such as http, https, mailto, ms-settings and ms-store, and the user picks the app that opens a scheme |
| `fileTypeName` | uap:FileTypeAssociation (manifest schema, Microsoft Learn) | the Name of uap:FileTypeAssociation is 1 to 64 characters, all lowercase, with no spaces |
| `bcp47Parts` | BCP 47, Tags for Identifying Languages and Matching of Language Tags | BCP 47 is made of RFC 5646 on the tags themselves and RFC 4647 on matching them |
| `langTagSyntax` | RFC 5646, Tags for Identifying Languages | a tag is a language subtag with optional script, region, variant, extension and private use subtags after it, separated by hyphens, of at most eight characters each and compared without case |
| `csvRecords` | RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files | each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice |
| `csvInjection` | CSV Injection (OWASP) | a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file |
| `jsonUtf8` | RFC 8259, The JSON Data Interchange Format | JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start |
| `jsonRepeatedNames` | RFC 8259, The JSON Data Interchange Format | when an object repeats a name the behavior of the software that reads it cannot be predicted, so the configuration reader of this tool refuses a repeated name |
| `xxeDoctype` | XML External Entity Prevention Cheat Sheet (OWASP) | the safest defence against XML external entities is to refuse DOCTYPE declarations, which also stops entity expansion that exhausts memory |
| `githubAnnotations` | Workflow commands for GitHub Actions (GitHub Docs) | a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run |

## The pages

| Page | Address |
| --- | --- |
| App package manifest (schema reference, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/appx-package-manifest |
| Package (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-package |
| Identity (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-identity |
| Properties (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-properties |
| TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-targetdevicefamily |
| Application (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-application |
| uap:VisualElements (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-visualelements |
| Capabilities (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-capabilities |
| Resource (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-resource |
| uap:Protocol (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol |
| uap:FileTypeAssociation (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-filetypeassociation |
| uap3:AppService (manifest schema, Microsoft Learn) | https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap3-appservice |
| App capability declarations (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/app-capability-declarations |
| What is MSIX? (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/msix/overview |
| Create a certificate for package signing (MSIX, Microsoft Learn) | https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing |
| Sign an app package using SignTool (MSIX, Microsoft Learn) | https://learn.microsoft.com/en-us/windows/msix/package/sign-app-package-using-signtool |
| Package a desktop app from source code using Visual Studio (MSIX, Microsoft Learn) | https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-packaging-dot-net |
| Integrate your desktop app with Windows using packaging extensions (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions |
| Handle URI activation with a Windows app (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/apps/develop/launch/handle-uri-activation |
| Launch the default Windows app for a URI (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-default-app |
| Tailor your resources for language, scale, high contrast, and other qualifiers (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/uwp/app-resources/tailor-resources-lang-scale-contrast |
| Windows release information (Microsoft Learn) | https://learn.microsoft.com/en-us/windows/release-health/release-information |
| BCP 47, Tags for Identifying Languages and Matching of Language Tags | https://www.rfc-editor.org/info/bcp47 |
| RFC 5646, Tags for Identifying Languages | https://www.rfc-editor.org/rfc/rfc5646 |
| RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files | https://www.rfc-editor.org/rfc/rfc4180 |
| RFC 8259, The JSON Data Interchange Format | https://www.rfc-editor.org/rfc/rfc8259 |
| CSV Injection (OWASP) | https://community.owasp.org/attacks/CSV_Injection |
| XML External Entity Prevention Cheat Sheet (OWASP) | https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html |
| Workflow commands for GitHub Actions (GitHub Docs) | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |
