# Method

This document says exactly what the tool reads, how it reads a manifest, what each rule looks at and cannot see, and
how the report is built. The names used here are the defaults; docs/inputs.md says how the configuration changes them.
The tool reads the manifest of a package and the asset files beside it on disk, and fetches nothing. It is a check
before a release goes out, not a signature verification and not a Store certification: a finding points at a line
worth a look, and a clean run says only that the manifest holds none of the problems below.

## What is read

The input is one or more manifest files and folders. A file named on the command line is read as a manifest whatever
its name; a folder is listed at its top only, in the order of the names, with no recursion (src/walk.js), and gives its
files named AppxManifest.xml or ending with .appxmanifest. A folder inside is counted and passed over, and a symbolic
link (or a junction on Windows) is counted and never followed.

Each manifest is read once (src/files.js), decoded by its byte order mark: UTF-16 little or big endian with one, UTF-8
with or without one. A UTF-8 file that holds a null byte or bytes that are not valid UTF-8, a UTF-16 file with an odd
number of bytes or a broken pair, and a file over 2 MB is an `unreadable-manifest` finding and nothing in it is
checked. The encoding is shown in the JSON report.

## How the manifest is read

The XML reader of src/xml.js reads the text once with a list of open elements of its own. It refuses a DOCTYPE, an
ENTITY declaration and any other `<!` declaration but comments and CDATA, decodes only the five entities of XML and
numeric character references, and refuses a file that is not well formed, each with its place. Every name is split into
its prefix and local name, and the prefix is resolved with the xmlns declarations in scope to the namespace URI it is
bound to; a prefix that is not declared is refused. An attribute with no prefix has no namespace.

The checks find every element by its local name and the family of its namespace URI (src/namespaces.js), never by its
prefix. The root must be `Package` of the foundation namespace, or the file is an `unreadable-manifest` finding. Below
it, Identity, Properties, Dependencies, Resources, Capabilities and Applications are read from the foundation namespace;
VisualElements, Protocol, FileTypeAssociation and their children from the uap family; Extension elements from any
family the table knows, by their Category; and Capability elements by their element and family (below).

A version in quad notation is four whole numbers separated by dots, each from 0 to 65535 (16 bits), written in decimal
with no sign and no leading zero (src/versions.js). A Windows build is the third part: 10.0.19041.0 is build 19041.

## The rules

### `missing-identity`

Looks for an Identity element of the foundation namespace below Package, and for its Name, Publisher and Version, each
present and not empty. One finding for a missing Identity, at Package; one for the parts that are missing, at Identity,
naming all of them. It cannot see whether the Name and Publisher are the ones Partner Center reserved for the app.

### `invalid-version`

Reads Identity Version as a quad version and reports one that is not four parts, a part that is not a whole number, has
a leading zero or is above 65535, at the value. A three-part version of a project file and a pipeline build number
above 65535 are the usual causes. It does not compare the version with an earlier release.

### `invalid-architecture`

Reports a ProcessorArchitecture that is not one of x86, x64, arm, arm64, x86a64 or neutral, compared with its case. An
Identity with no ProcessorArchitecture is not reported, because a package with no code (a resource package) may leave
it out; the tool cannot see whether the package holds code.

### `invalid-publisher`

Reads Identity Publisher as a distinguished name (src/publisher.js): parts of TYPE=value separated by commas, or plus
signs inside one part; a type of letters, digits and hyphens starting with a letter, or a dotted object identifier; a
value as plain text with a backslash before a special character, or in double quotes. A semicolon between parts, an
equals sign, quote or angle bracket inside a plain value, an empty value, a separator at the end and a name with no CN
are reported, at the place of the problem when it can be found. It does not check the types against a list.

### `publisher-mismatch`

Only with `--cert-subject`. Compares Identity Publisher with the subject given, as text, exactly. The message names the
first part that differs, or says that only the spacing, quoting or order differs, because signing compares the text.
It cannot see the certificate itself: the subject is what the pipeline passes in.

### `missing-target-device-family`

Reports a manifest with no Dependencies, a Dependencies with no TargetDeviceFamily, and a TargetDeviceFamily with no
Name, MinVersion or MaxVersionTested, or with one that is empty. It does not check the Name against the list of device
families.

### `invalid-target-version`

Reads MinVersion and MaxVersionTested of each TargetDeviceFamily as quad versions; a version that is not one is
reported at its value, and a MinVersion above the MaxVersionTested of the same element is reported at MinVersion,
because the package would install only on builds it was never tested on. Equal versions are fine. Versions of two
TargetDeviceFamily elements are not compared with each other.

### `min-version-below-floor`

The tool's own choice. Reports a MinVersion below `minBuildFloor` (10.0.17763.0 by default), with both builds. The
floor is a number of the configuration, never a date (decision 1); it stands for the oldest build the team supports
and tests, and docs/inputs.md says how the default was chosen. A MaxVersionTested that is old is not reported.

### `restricted-capability`

Each Capability element whose namespace URI is of the rescap family, under any prefix, with a Name that is not in
`allowedRestrictedCapabilities`, is reported at its Name, with a note on what it allows (src/capabilities.js) and the
reminder that a Store submission must say why the app needs it. A sideloaded package needs no approval, so the default
level is warning. An allowed one is shown in the summary and not reported.

### `general-capability`

Each Capability of the foundation or uap family (general-use), each DeviceCapability of the foundation namespace and
each CustomCapability of the uap family is listed as info, with a note when the name is known. None is a problem by
itself; the list is for the reviewer. A capability element of a namespace the table does not know is not counted.

### `missing-properties`

Reports a manifest with no Properties, and a Properties with no DisplayName, PublisherDisplayName or Logo of the
foundation namespace, or with one that is empty, naming all that is missing in one finding. A `uap:DisplayName` is not
the DisplayName of Properties. It cannot see whether a value is a resource reference that resolves.

### `missing-asset`

Only with `--root`. The Logo of Properties, the Square150x150Logo and Square44x44Logo of each VisualElements, the
Wide310x150Logo, Square71x71Logo and Square310x310Logo of its DefaultTile, the Image of its SplashScreen, the BadgeLogo
of its LockScreen, and the Logo of each protocol and file type association are looked for under the root
(src/assets.js). The path uses backslashes or slashes and is relative to the root; each folder of it is found by its
name with the case ignored, as Windows does. In the last folder, the file counts as found when the folder holds:

- the file itself, with its case ignored;
- the file with qualifiers between its stem and its extension: `Logo.scale-200.png`,
  `Logo.targetsize-48_altform-unplated.png`, where each qualifier is a known name (scale, targetsize, altform,
  contrast, theme, lang, language and the others of the resource system) and a value;
- a folder of qualifiers, such as `scale-200` or `contrast-high_scale-400`, that holds the file plain or with
  qualifiers (up to 50 such folders are looked in).

A path that is empty, absolute, an address such as `ms-appx:///`, or that leaves the root with `..` is reported without
a look, and so is a path through a symbolic link, which is not followed. The images are not opened, so their size,
format and scale are not checked.

### `invalid-application`

Each Application of the foundation namespace below Applications: an Application with no Id; with no StartPage and no
Executable; with an Executable that does not end with .exe (any case); and with an Executable, no StartPage, no
EntryPoint and no uap10:RuntimeBehavior of packagedClassicApp or win32App. A uap10:RuntimeBehavior of windowsApp still
needs an EntryPoint. Contradicting activation attributes are not checked.

### `duplicate-application-id`

Two Applications with the same Id, compared with their case; the second is reported at its Id with the line of the
first.

### `missing-visual-elements`

An Application with no VisualElements of the uap family (or the foundation namespace), and a VisualElements with no
DisplayName, Description, BackgroundColor, Square150x150Logo or Square44x44Logo, or with one that is empty, naming all
that is missing in one finding. The value of BackgroundColor is not checked against the list of color names.

### `invalid-association`

For each Extension of the category windows.protocol, each Protocol of the uap family: a Name that is missing, not 2 to
2,048 characters, not all lowercase, not starting with a letter, or holding a character other than letters, digits,
`+`, `-` and `.` (the form of a URI scheme); and a Name already declared by another protocol of the package. For each
Extension of the category windows.fileTypeAssociation, each FileTypeAssociation: a Name that is missing, not 1 to 64
characters, not all lowercase or holding a space; no FileType at all; and a FileType that does not start with a dot,
is only a dot, or holds a space.

### `reserved-protocol`

The tool's own choice. A protocol Name in `reservedProtocols` (http, https, file, ftp, mailto, microsoft-edge and every
name starting with ms- by default), compared without case; an entry that ends with `*` is a prefix. An app that
registers such a scheme competes with the handlers of Windows for every link of it.

### `extension-listed`

Each Extension of an application, in any namespace family, of the category windows.startupTask, windows.fullTrustProcess,
windows.appService, windows.comServer, windows.appExecutionAlias or windows.firewallRules, listed as info with what it
implies and its Executable when it has one. Other categories are passed over; package-level extensions are not read.

### `missing-resource-language`

A manifest with no Resources of the foundation namespace, or with no Resource that has a Language that is not empty.

### `invalid-language-tag`

Each Resource Language checked as a well-formed BCP 47 tag (src/languages.js): subtags of letters and digits separated
by hyphens, at most eight characters each; a language of two to eight letters (with up to three extended language
subtags after two or three letters); then an optional script of four letters, a region of two letters or three digits,
variants (five to eight characters, or four starting with a digit, none twice), extensions after a single letter (none
twice, each with a subtag of two to eight characters) and a private use part after x; or a grandfathered tag. An
underscore, as in `en_US`, is the usual mistake. `x-generate` is a private use tag and well formed. Whether a subtag is
in the IANA registry is not checked.

### `unreadable-manifest`

A file over 2 MB, a binary file, a file that is not valid UTF-8 or UTF-16 with its mark, XML that is not well formed,
with a DOCTYPE or an ENTITY declaration, a prefix that is not declared, and a root that is not Package of the
foundation namespace. Nothing in the file is checked. This rule cannot be set lower or off.

### `scan-limit`

A folder of manifests or a folder under the root with more than 10,000 entries, more than 200 manifests in a run, and a
manifest that names more than 500 asset paths. The rest is not read, so the run fails. This rule cannot be set lower or
off.

## The summary

For each manifest read, the report gives the Name and Publisher of Identity, its Version and ProcessorArchitecture, the
DisplayName of Properties, each TargetDeviceFamily with its MinVersion and MaxVersionTested and their builds, the
capabilities by group (restricted, general, device, custom) with those allowed by the configuration, the applications
with their Executable, the protocols, file types and listed extensions, and the languages. The table of manifests gives
the lowest MinVersion build and the highest MaxVersionTested build.

## The report

The findings are sorted by level (errors first), then file, line, column and the order of the rules. Text from a file
goes through `safeText`, which removes control, line separator and direction characters and caps the length. At most
500 findings of one rule are listed; the rest are counted in a note and still count for the result. The run fails when
a finding is at or above `failOn`. Every report ends with the notice that it is a check and not a signature
verification and not a Store certification.
