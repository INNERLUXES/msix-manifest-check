// The public pages the checks rest on, and what each says, written in this project's own words. research/sources.md
// lists every page with a longer note on each, and test/data.test.js checks that every page here is listed there and
// that every rule names points that exist. The code in src/ uses these constants and never writes a reason of its own
// in a report.

const SCHEMA = 'https://learn.microsoft.com/en-us/uwp/schemas/appxpackage';
const ELEMENT = `${SCHEMA}/uapmanifestschema`;
const MSIX = 'https://learn.microsoft.com/en-us/windows/msix';
const APPS = 'https://learn.microsoft.com/en-us/windows/apps';

export const SOURCES = [
  { id: 'manifestSchema', title: 'App package manifest (schema reference, Microsoft Learn)', url: `${SCHEMA}/appx-package-manifest` },
  { id: 'elementPackage', title: 'Package (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-package` },
  { id: 'elementIdentity', title: 'Identity (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-identity` },
  { id: 'elementProperties', title: 'Properties (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-properties` },
  { id: 'elementTargetDeviceFamily', title: 'TargetDeviceFamily in Dependencies (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-targetdevicefamily` },
  { id: 'elementApplication', title: 'Application (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-application` },
  { id: 'elementVisualElements', title: 'uap:VisualElements (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-uap-visualelements` },
  { id: 'elementCapabilities', title: 'Capabilities (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-capabilities` },
  { id: 'elementResource', title: 'Resource (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-resource` },
  { id: 'elementProtocol', title: 'uap:Protocol (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-uap-protocol` },
  { id: 'elementFileTypeAssociation', title: 'uap:FileTypeAssociation (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-uap-filetypeassociation` },
  { id: 'elementAppService', title: 'uap3:AppService (manifest schema, Microsoft Learn)', url: `${ELEMENT}/element-uap3-appservice` },
  { id: 'capabilities', title: 'App capability declarations (Microsoft Learn)', url: `${APPS}/package-and-deploy/app-capability-declarations` },
  { id: 'msixOverview', title: 'What is MSIX? (Microsoft Learn)', url: `${MSIX}/overview` },
  { id: 'signingCertificate', title: 'Create a certificate for package signing (MSIX, Microsoft Learn)', url: `${MSIX}/package/create-certificate-package-signing` },
  { id: 'signTool', title: 'Sign an app package using SignTool (MSIX, Microsoft Learn)', url: `${MSIX}/package/sign-app-package-using-signtool` },
  { id: 'packageDesktop', title: 'Package a desktop app from source code using Visual Studio (MSIX, Microsoft Learn)', url: `${MSIX}/desktop/desktop-to-uwp-packaging-dot-net` },
  { id: 'desktopExtensions', title: 'Integrate your desktop app with Windows using packaging extensions (Microsoft Learn)', url: `${APPS}/desktop/modernize/desktop-to-uwp-extensions` },
  { id: 'uriActivation', title: 'Handle URI activation with a Windows app (Microsoft Learn)', url: `${APPS}/develop/launch/handle-uri-activation` },
  { id: 'builtInSchemes', title: 'Launch the default Windows app for a URI (Microsoft Learn)', url: `${APPS}/develop/launch/launch-default-app` },
  { id: 'resourceQualifiers', title: 'Tailor your resources for language, scale, high contrast, and other qualifiers (Microsoft Learn)', url: 'https://learn.microsoft.com/en-us/windows/uwp/app-resources/tailor-resources-lang-scale-contrast' },
  { id: 'releaseInformation', title: 'Windows release information (Microsoft Learn)', url: 'https://learn.microsoft.com/en-us/windows/release-health/release-information' },
  { id: 'bcp47', title: 'BCP 47, Tags for Identifying Languages and Matching of Language Tags', url: 'https://www.rfc-editor.org/info/bcp47' },
  { id: 'rfc5646', title: 'RFC 5646, Tags for Identifying Languages', url: 'https://www.rfc-editor.org/rfc/rfc5646' },
  { id: 'rfc4180', title: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files', url: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'rfc8259', title: 'RFC 8259, The JSON Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
  { id: 'owaspCsv', title: 'CSV Injection (OWASP)', url: 'https://community.owasp.org/attacks/CSV_Injection' },
  { id: 'owaspXxe', title: 'XML External Entity Prevention Cheat Sheet (OWASP)', url: 'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html' },
  { id: 'githubCommands', title: 'Workflow commands for GitHub Actions (GitHub Docs)', url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// What a page says, in this project's own words. Each point names its page.
export const POINTS = {
  manifestSigned: { source: 'manifestSchema', text: 'every app package holds one manifest with its identity, dependencies, capabilities, visual elements and extension points, and the manifest is signed with the package, so it cannot change after signing' },
  packageChildren: { source: 'elementPackage', text: 'Package holds Identity, Properties and Dependencies, and may hold Resources, Capabilities, Extensions and Applications' },
  packageLanguage: { source: 'elementPackage', text: 'every package must declare at least one language for its resources' },
  identityFields: { source: 'elementIdentity', text: 'Name, Publisher and Version are required; Version is in quad notation, major.minor.build.revision; ProcessorArchitecture is x86, x64, arm, arm64, x86a64 or neutral, and a package with executable code has it' },
  identityPublisher: { source: 'elementIdentity', text: 'the Publisher must match the publisher subject of the certificate the package is signed with' },
  certSubject: { source: 'signingCertificate', text: 'the Subject of the signing certificate must match the Publisher of the manifest, a distinguished name such as CN=..., O=..., C=...' },
  signTool: { source: 'signTool', text: 'a package is signed with SignTool and a certificate, with the hash algorithm the package was made with, before it goes to the Store' },
  msixSigned: { source: 'msixOverview', text: 'every MSIX package must be signed before it is installed, and Windows reads the manifest to deploy, show and update the app' },
  propertiesFields: { source: 'elementProperties', text: 'Properties needs DisplayName, PublisherDisplayName and Logo, the path to a file that holds an image' },
  tdfFields: { source: 'elementTargetDeviceFamily', text: 'TargetDeviceFamily needs Name, MinVersion and MaxVersionTested, and both versions are in quad notation' },
  tdfMeaning: { source: 'elementTargetDeviceFamily', text: 'the app is not applicable on a system older than MinVersion, and MaxVersionTested is the newest version the app was tested against, which decides the behavior it gets' },
  servicedBuilds: { source: 'releaseInformation', text: 'Microsoft lists the Windows builds that are still serviced, with the end of servicing of each, and the list changes over time' },
  applicationFields: { source: 'elementApplication', text: 'Id is required and cannot be used twice in one package; Executable ends with .exe; without StartPage, both Executable and EntryPoint are given' },
  applicationActivation: { source: 'elementApplication', text: 'uap10:RuntimeBehavior with uap10:TrustLevel can stand in for EntryPoint, and Windows.FullTrustApplication is the entry point of a full-trust desktop app' },
  visualElementsFields: { source: 'elementVisualElements', text: 'uap:VisualElements needs DisplayName, Description, BackgroundColor, Square150x150Logo and Square44x44Logo, and a logo is a .png, .jpg or .jpeg path' },
  visualElementsScales: { source: 'elementVisualElements', text: 'the logos can be given in several scales, so that Windows picks the best image for the display' },
  qualifiedNames: { source: 'resourceQualifiers', text: 'a qualifier such as scale-200 goes in the file name (logo.scale-200.png) or in a folder name (scale-200/logo.png), and a file with no qualifier is the neutral match' },
  capabilityGroups: { source: 'capabilities', text: 'capabilities are general-use, device, restricted or custom, and restricted ones are declared in the rescap namespace' },
  restrictedApproval: { source: 'capabilities', text: 'restricted capabilities are for very specific scenarios; a Store submission that declares one must say why, and the testers approve it or fail the submission, while sideloading needs no approval' },
  capabilityList: { source: 'elementCapabilities', text: 'Capabilities holds Capability elements of the foundation, uap and rescap namespaces, DeviceCapability and CustomCapability elements' },
  packagedDesktop: { source: 'packageDesktop', text: 'a desktop app is packaged with a packaging project that writes the manifest, makes the visual assets and builds the package for the Store or for sideloading' },
  extensionsDesktop: { source: 'desktopExtensions', text: 'a packaged desktop app joins Windows through extensions, each the Category of an Extension element: protocols, file types, startup tasks, COM servers and more' },
  appService: { source: 'elementAppService', text: 'an app service lets other apps call a background task of this app by its service name' },
  resourceLanguage: { source: 'elementResource', text: 'the Language of a Resource is a BCP 47 language tag, and the first Resource names the default language' },
  protocolName: { source: 'elementProtocol', text: 'the Name of uap:Protocol is the URI scheme, 2 to 2,048 characters, unique in the package' },
  protocolLowercase: { source: 'uriActivation', text: 'the scheme name must be all lowercase, an app should register a scheme only to handle all of it, and a new scheme name follows RFC 4395' },
  builtInSchemes: { source: 'builtInSchemes', text: 'Windows comes with handlers for schemes such as http, https, mailto, ms-settings and ms-store, and the user picks the app that opens a scheme' },
  fileTypeName: { source: 'elementFileTypeAssociation', text: 'the Name of uap:FileTypeAssociation is 1 to 64 characters, all lowercase, with no spaces' },
  bcp47Parts: { source: 'bcp47', text: 'BCP 47 is made of RFC 5646 on the tags themselves and RFC 4647 on matching them' },
  langTagSyntax: { source: 'rfc5646', text: 'a tag is a language subtag with optional script, region, variant, extension and private use subtags after it, separated by hyphens, of at most eight characters each and compared without case' },
  csvRecords: { source: 'rfc4180', text: 'each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice' },
  csvInjection: { source: 'owaspCsv', text: 'a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file' },
  jsonUtf8: { source: 'rfc8259', text: 'JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start' },
  jsonRepeatedNames: { source: 'rfc8259', text: 'when an object repeats a name the behavior of the software that reads it cannot be predicted, so the configuration reader of this tool refuses a repeated name' },
  xxeDoctype: { source: 'owaspXxe', text: 'the safest defence against XML external entities is to refuse DOCTYPE declarations, which also stops entity expansion that exhausts memory' },
  githubAnnotations: { source: 'githubCommands', text: 'a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run' }
};

// The page of a point.
export const pointPage = (key) => source(POINTS[key].source);

// The levels of a finding, from the lowest.
export const LEVELS = ['info', 'warning', 'error'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This check reads the manifest and the asset files beside it on disk and fetches nothing. A finding is a lead with a file and a line, and a clean result is not a signature verification and not a Store certification (docs/limits.md).';
