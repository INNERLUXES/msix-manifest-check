# Sources

The public pages the checks of this tool are based on, each with a short note in this project's own words on what the
page says and which parts of the tool lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. src/data.js holds the pages and the points the reports show, and test/data.test.js checks that every page in
src/data.js is listed here.
Each page was fetched and read before it was listed.

The tool reads the manifest and the asset files on disk; a clean result is not a signature verification and not a
Store certification. These notes say what the pages say so a reader can follow a finding back to its source; they are
not advice on how to ship any one app. The pages were chosen with web addresses that hold no number that reads like a
year, and Windows releases are named here by their build number only.

## The package manifest schema

### App package manifest (schema reference, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/appx-package-manifest

The front page of the schema reference. The package manifest is an XML document with what Windows needs to deploy,
show and update an app: the identity of the package, its dependencies, the capabilities it asks for, its visual
elements and its extension points. Every app package holds exactly one. The manifest is signed with the package, so it
cannot be changed after signing without breaking the signature, and that is why the tool checks it before signing.
`unreadable-manifest` leans on it.

### Package (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-package

The root element. Package, in the foundation namespace, holds Identity, Properties and Dependencies, and may hold
Resources, Capabilities, Extensions and Applications; IgnorableNamespaces lists namespaces whose elements are not
validated. The page also says that every package must declare at least one language for its resources. The tool
refuses a file whose root is not Package of the foundation namespace, and `missing-identity`, `missing-properties`,
`missing-target-device-family` and `missing-resource-language` lean on it.

### Identity (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-identity

The identity of the package. Name, Publisher and Version are required; ProcessorArchitecture and ResourceId are
optional. Version is in quad notation, major.minor.build.revision, as in 1.2.3.4. ProcessorArchitecture is one of x86,
x64, arm, arm64, x86a64 or neutral, and a package that holds executable code must have it. The Publisher must match the
publisher subject of the certificate the package is signed with, and the example on the page is a distinguished name
of CN, O, L, S and C parts. `missing-identity`, `invalid-version`, `invalid-architecture`, `invalid-publisher` and
`publisher-mismatch` lean on it. The parts of 0 to 65535 are the 16-bit parts of the schema's version type.

### Properties (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-properties

The metadata of the package that users see. DisplayName, PublisherDisplayName and Logo are required; Logo is the path
to a file that holds an image. Description, Framework, ResourcePackage and many optional settings follow. The example
writes the logo path with a backslash, relative to the package. `missing-properties` and `missing-asset` lean on it.

### TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-targetdevicefamily

The device family a package targets, inside Dependencies. Name, MinVersion and MaxVersionTested are all required, and
both versions are in quad notation. A system older than MinVersion does not see the app as applicable; MaxVersionTested
is the newest version the app was tested against, and it decides which behavior of the system the app gets. The page
lists Windows.Universal, Windows.Desktop, Windows.Xbox and other family names, and allows several TargetDeviceFamily
elements. `missing-target-device-family`, `invalid-target-version` and `min-version-below-floor` lean on it; a
MinVersion above MaxVersionTested is reported because it describes an app that installs only on builds it was never
tested on.

### Application (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-application

One app of the package. Id is required and is unique within the package: the same Id cannot be used twice, and it
should not change after the app is published, because the Start tile follows it. Executable ends with .exe. When there
is no StartPage, both Executable and EntryPoint are given. The page lists the combinations of activation attributes:
EntryPoint of Windows.FullTrustApplication for a full-trust desktop app, or uap10:RuntimeBehavior with uap10:TrustLevel
in its place; windowsApp still needs an EntryPoint. `invalid-application` and `duplicate-application-id` lean on it.

### uap:VisualElements (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-visualelements

The tile, logos and colors of an app. DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo
are required; a logo is a path of up to 256 characters that ends with .png, .jpg or .jpeg. DefaultTile, SplashScreen,
LockScreen and InitialRotationPreference are optional children. The logos can be given in several scales so that
Windows picks the best one for the display. `missing-visual-elements` and `missing-asset` lean on it.

### Capabilities (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-capabilities

The access a package asks for. Capabilities holds Capability elements (of the foundation, uap and rescap namespaces),
CustomCapability and DeviceCapability elements; the example lists general capabilities such as internetClient,
internetClientServer and privateNetworkClientServer next to uap:Capability elements such as picturesLibrary.
`general-capability` leans on it.

### Resource (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-resource

A language, scale or DirectX feature level of the resources of the package. Language is a BCP 47 language tag. In
Package.appxmanifest, Language="x-generate" asks Visual Studio to write the languages it finds in the project, and the
first Resource names the default language. `missing-resource-language` and `invalid-language-tag` lean on it; the tool
reads x-generate as the well-formed private use tag it is.

### uap:Protocol (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol

The windows.protocol extension: the app handles URIs of a scheme. Name is the scheme, 2 to 2,048 characters, unique for
the package; a Logo and a DisplayName are optional. `invalid-association` leans on it.

### uap:FileTypeAssociation (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-filetypeassociation

The windows.fileTypeAssociation extension: the app handles files of the types listed in SupportedFileTypes. Name is 1
to 64 characters, all lowercase, with no spaces. `invalid-association` leans on it; that a FileType starts with a dot
is the tool's own reading of the examples.

### uap3:AppService (manifest schema, Microsoft Learn)

https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap3-appservice

The windows.appService extension: other apps can call a background task of this app by its service name. The name
is 2 to 39 characters of letters, digits, periods and dashes. `extension-listed` leans on it.

## Capabilities, signing and packaging

### App capability declarations (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/app-capability-declarations

The reference of capabilities for UWP and other packaged apps. Capabilities are general-use, device, restricted or
custom. Restricted capabilities are declared in the rescap namespace and are meant for very specific scenarios; a Store
submission that declares one must give the reason in Partner Center, the testers review it, and an approval is not
needed again for an update that adds no capability; an app that is sideloaded needs no approval. The page describes
each restricted capability: runFullTrust for packages with full-trust (medium integrity) code, broadFileSystemAccess
for access to every file the user can reach, with the reasons the pickers are not enough asked for, allowElevation
under strict criteria with a justification sent ahead, packageManagement, unvirtualizedResources,
localSystemServices, customInstallActions and others. The general and device tables cover internetClient,
internetClientServer, privateNetworkClientServer, the libraries, webcam, microphone and location, and say that users
can turn privacy-sensitive access off. `restricted-capability` and `general-capability` lean on it, and the notes of
src/capabilities.js follow it.

### What is MSIX? (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/msix/overview

The overview of the format. A package gives the app an identity of publisher, name and version, which the Store, push
notifications and other platform features need. A package holds the app payload, AppxBlockMap.xml with the hashes of
its blocks, AppxManifest.xml, which Windows reads to deploy, show and update the app, and AppxSignature.p7x; every MSIX
package must be signed before it is installed. `publisher-mismatch` and the notice of the reports lean on it.

### Create a certificate for package signing (MSIX, Microsoft Learn)

https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing

How to make a certificate to sign a package. To sign a package with a certificate, the Subject of the certificate must
match the Publisher of the manifest, and the page builds the certificate with the manifest's Publisher as its subject,
a distinguished name of CN, O and C. A self-signed certificate is for testing; a release uses a certificate from a
trusted source. `publisher-mismatch` and `invalid-publisher` lean on it.

### Sign an app package using SignTool (MSIX, Microsoft Learn)

https://learn.microsoft.com/en-us/windows/msix/package/sign-app-package-using-signtool

How to sign a package with SignTool: the hash algorithm must be the one the package was made with, and the certificate
is a .pfx file or one in a certificate store. Once signed with a valid certificate the package can go to the Store. It
explains where `--cert-subject` comes from in a pipeline: the subject of the certificate SignTool will use.

### Package a desktop app from source code using Visual Studio (MSIX, Microsoft Learn)

https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-packaging-dot-net

How a desktop app is packaged with a Windows Application Packaging Project: the project writes the manifest
(Package.appxmanifest), makes the visual assets, lets one application be the entry point and builds a package or an
upload file for the Store. The tool reads that manifest before the build, or AppxManifest.xml after it.

### Integrate your desktop app with Windows using packaging extensions (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions

The extensions a packaged desktop app can declare, each by the Category of an Extension element in a namespace such as
desktop, desktop2, uap3 or com: file type associations, protocols, execution aliases, firewall rules, startup tasks
(windows.startupTask, an executable that starts when the user signs in), COM servers, full-trust processes and more.
`extension-listed` leans on it, and the table of namespaces of src/namespaces.js takes the URIs of its examples.

### Handle URI activation with a Windows app (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/apps/develop/launch/handle-uri-activation

How an app registers a URI scheme in the manifest. The name of the scheme must be all lowercase, an app should
register a scheme only when it handles every URI of it, and a new scheme name follows the guidance of RFC 4395. The
page also asks to treat the parameters of a URI as untrusted input. `invalid-association` and `reserved-protocol` lean
on it.

### Launch the default Windows app for a URI (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-default-app

The schemes that come with Windows: http and https open the default browser, mailto the email app, microsoft-edge the
browser of Windows, and ms-settings, ms-store, ms-photos, ms-people and other ms- schemes the apps of Windows. More
than one app can register a scheme, and the user picks the one that opens it. The default list of `reserved-protocol`
is the tool's own choice after this page.

### Tailor your resources for language, scale, high contrast, and other qualifiers (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/uwp/app-resources/tailor-resources-lang-scale-contrast

How a resource names the context it is for. A qualifier is a name and a value, such as scale-200, contrast-high or
targetsize-48, written in a file name (logo.scale-200.png) or in a folder name (scale-200/logo.png), several of them
joined by an underscore; qualifier names and values are not case sensitive, and a file with no qualifier is the neutral
match. `missing-asset` leans on it: a logo path counts as found when a file with qualifiers is there.

### Windows release information (Microsoft Learn)

https://learn.microsoft.com/en-us/windows/release-health/release-information

The list of Windows releases with their builds and the end of servicing of each, including the long-term servicing
editions. It changes over time. The default `minBuildFloor` of build 17763 was taken from it as a long-term servicing
build of Windows 10 still on the list; when it was read, build 14393 was the only older build there, close to the end
of its servicing. Check the page and set `minBuildFloor` for your app.

## Language tags

### BCP 47, Tags for Identifying Languages and Matching of Language Tags

https://www.rfc-editor.org/info/bcp47

The best current practice for language tags, made of RFC 5646 (the tags) and RFC 4647 (matching them).

### RFC 5646, Tags for Identifying Languages

https://www.rfc-editor.org/rfc/rfc5646

The syntax of a language tag: a language subtag of two or three letters (with up to three extended language subtags),
four letters or five to eight letters, then an optional script of four letters, a region of two letters or three
digits, variants, extensions after a single letter and a private use part after x, separated by hyphens, at most eight
characters each, compared without regard to case, plus a short list of grandfathered tags. `invalid-language-tag`
checks this form; the registry of subtags is not read.

## Output and safe reading

### RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files

https://www.rfc-editor.org/rfc/rfc4180

The CSV format: one record a line, ended by CRLF, an optional header line, and a field with a comma, a double quote or
a line break put in double quotes, with a double quote inside written twice. The CSV report follows it.

### RFC 8259, The JSON Data Interchange Format

https://www.rfc-editor.org/rfc/rfc8259

The JSON format. JSON exchanged between systems must be UTF-8, and a reader may ignore a byte order mark. When the
names of an object are not unique, the behavior of the software that reads it is unpredictable, so the configuration
reader refuses a name given twice.

### CSV Injection (OWASP)

https://community.owasp.org/attacks/CSV_Injection

A spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and the escapes that
work differ from program to program. The CSV report puts a single quote in front of such a field, and the threat
model says to open a report built from files you do not trust with formulas turned off.

### XML External Entity Prevention Cheat Sheet (OWASP)

https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html

The safest defence against XML external entities is to turn off DTDs, refusing any DOCTYPE declaration, which also
stops the entity expansion that exhausts memory. The XML reader of the tool refuses every DOCTYPE and ENTITY
declaration and every entity other than the five of XML.

### Workflow commands for GitHub Actions (GitHub Docs)

https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

The error, warning and notice commands with file, line, col and title parameters create annotations on a file and a
line of the repository. The GitHub format writes one command per finding and escapes what a command gives a meaning
to.
