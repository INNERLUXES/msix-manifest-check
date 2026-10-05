# Inputs

## The manifests

```
msix-manifest-check <manifest or folder>... [--root <folder>] [--cert-subject "<CN=...>"] [--config <file>]
```

Name one or more manifest files or folders, up to 100. A file named on the command line is read as a manifest whatever
its name. A folder is read at its top only, and gives its files named `AppxManifest.xml` or ending with `.appxmanifest`
(such as `Package.appxmanifest`), in any case; a folder inside it, a symbolic link and any other file are counted and
passed over. A path named twice stops the run; a manifest named and also found in a folder is read once.

Both forms of the manifest are read the same way: `Package.appxmanifest`, the source a packaging project keeps, and
`AppxManifest.xml`, the file in the built package. The file is read as UTF-8, with or without a byte order mark, or as
UTF-16 little or big endian with its byte order mark. A manifest that cannot be read is an `unreadable-manifest`
finding, and the run goes on with the others.

## The root of the package

`--root <folder>` names the folder that the logo and image paths of the manifest start from: the folder of the
packaging project, or the folder of the package laid out before it is packed. With it, every logo path is looked for
under that folder (docs/method.md says how, with qualifiers such as `.scale-200`). Without it, no asset is looked for
and the report says so. A root that is a file, a symbolic link or missing stops the run with exit code `2`. Give one
root for the manifests of one package; check two packages in two runs.

## The certificate subject

`--cert-subject "<CN=...>"` gives the subject of the certificate the package will be signed with, as text, such as
`"CN=Contoso Software, O=Contoso Corporation, C=US"`. The Publisher of each manifest must be exactly that text. The
subject itself must be a distinguished name with a CN, or the run stops with exit code `2`. In a pipeline, read the
subject from the certificate the signing step uses (for example with `Get-PfxCertificate` or `certutil`), so the check
compares the manifest with the certificate and not with a second copy of the manifest.

## The configuration file

The configuration is one JSON object, read by a strict reader of RFC 8259 (no comments, no trailing comma, no name
given twice). Every key is optional; without `--config` the defaults apply, and `--print-defaults` writes them out. A key
the tool does not know is an error with its line and a suggestion, and stops the run with exit code `2`.

```json
{
  "name": "Brindlecote release review",
  "minBuildFloor": "10.0.17763.0",
  "allowedRestrictedCapabilities": ["runFullTrust"],
  "reservedProtocols": ["http", "https", "file", "ftp", "mailto", "microsoft-edge", "ms-*", "brindlecote-admin"],
  "rules": { "invalidLanguageTag": "error", "generalCapability": "off" },
  "minSeverity": "info",
  "failOn": "error"
}
```

| Key | Value | Default |
| --- | --- | --- |
| `name` | a text of 1 to 120 characters, shown in the report | none |
| `rules` | an object of rule keys to `info`, `warning`, `error` or `off` | below |
| `minBuildFloor` | a quad version; a TargetDeviceFamily MinVersion below it is reported by `min-version-below-floor` | `10.0.17763.0` |
| `allowedRestrictedCapabilities` | up to 100 names of restricted capabilities that are not reported, because the team has a justification for each | none |
| `reservedProtocols` | up to 100 protocol names an app should not register; a name ending with `*` is a prefix | `http`, `https`, `file`, `ftp`, `mailto`, `microsoft-edge`, `ms-*` |
| `minSeverity` | the lowest level shown: `info`, `warning` or `error` | `info` |
| `failOn` | the lowest level that fails the run | `error` |

A list replaces its default as a whole, and an empty list turns that part off: no restricted capability allowed, or no
protocol reserved. A name given twice is kept once. `--min-severity` and `--fail-on` on the command line win over the
configuration.

### How the default build floor was chosen

`minBuildFloor` is a number, not a date, and it does not move by itself. Its default, `10.0.17763.0`, is build 17763, a
build of the long-term servicing channel of Windows 10 that Microsoft's Windows release information page still listed
as serviced when the default was chosen; build 14393 was the only older build on that page, close to the end of its
servicing. The page changes over time. Read it, decide which builds your app supports and tests, and set
`minBuildFloor` to the oldest of them; a MinVersion below it is a warning, not an error, because a team may support an
older build on purpose.

## The keys of rules

| Key | Rule | Default |
| --- | --- | --- |
| `rules.missingIdentity` | `missing-identity` | error |
| `rules.invalidVersion` | `invalid-version` | error |
| `rules.invalidArchitecture` | `invalid-architecture` | error |
| `rules.invalidPublisher` | `invalid-publisher` | error |
| `rules.publisherMismatch` | `publisher-mismatch` | error |
| `rules.missingTargetDeviceFamily` | `missing-target-device-family` | error |
| `rules.invalidTargetVersion` | `invalid-target-version` | error |
| `rules.minVersionBelowFloor` | `min-version-below-floor` | warning |
| `rules.restrictedCapability` | `restricted-capability` | warning |
| `rules.generalCapability` | `general-capability` | info |
| `rules.missingProperties` | `missing-properties` | error |
| `rules.missingAsset` | `missing-asset` | warning |
| `rules.invalidApplication` | `invalid-application` | error |
| `rules.duplicateApplicationId` | `duplicate-application-id` | error |
| `rules.missingVisualElements` | `missing-visual-elements` | error |
| `rules.invalidAssociation` | `invalid-association` | error |
| `rules.reservedProtocol` | `reserved-protocol` | error |
| `rules.extensionListed` | `extension-listed` | info |
| `rules.missingResourceLanguage` | `missing-resource-language` | error |
| `rules.invalidLanguageTag` | `invalid-language-tag` | warning |

`unreadable-manifest` and `scan-limit` have no key: they are always errors. Setting a rule to `off` leaves it out of
the findings and the counts, and a note names it.

## Namespaces

A manifest binds prefixes of its own choosing to fixed namespace URIs: `uap`, `rescap`, `desktop` and `uap10` are only
the usual prefixes. The tool reads every element and attribute by the URI its prefix is bound to, and never by the
prefix, so `<restricted:Capability>` with `xmlns:restricted` bound to the URI of restricted capabilities is a restricted
capability, and `<rescap:Capability>` with `rescap` bound to another URI is not. The URIs it knows are kept in one data
file, src/namespaces.js; each belongs to a family, and a check asks for a family, so a `VisualElements` of any uap
version is found. A URI that is not in the table is read but belongs to no family, so the checks pass over its
elements. The URIs are compared as written, with their case.

| URI | Family | Usual prefix |
| --- | --- | --- |
| `http://schemas.microsoft.com/appx/manifest/foundation/windows10` | foundation | (default) |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10` | uap | uap |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/2` | uap | uap2 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/3` | uap | uap3 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/4` | uap | uap4 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/5` | uap | uap5 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/6` | uap | uap6 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/7` | uap | uap7 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/8` | uap | uap8 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/10` | uap | uap10 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/11` | uap | uap11 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/12` | uap | uap12 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/13` | uap | uap13 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/15` | uap | uap15 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/16` | uap | uap16 |
| `http://schemas.microsoft.com/appx/manifest/uap/windows10/17` | uap | uap17 |
| `http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities` | rescap | rescap |
| `http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities/3` | rescap | rescap3 |
| `http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities/6` | rescap | rescap6 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10` | desktop | desktop |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/2` | desktop | desktop2 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/3` | desktop | desktop3 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/4` | desktop | desktop4 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/5` | desktop | desktop5 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/6` | desktop | desktop6 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/7` | desktop | desktop7 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/10` | desktop | desktop10 |
| `http://schemas.microsoft.com/appx/manifest/desktop/windows10/11` | desktop | desktop11 |
| `http://schemas.microsoft.com/appx/manifest/com/windows10` | com | com |
| `http://schemas.microsoft.com/appx/manifest/iot/windows10/2` | iot | iot2 |

To add a URI, add it to src/namespaces.js with its family, add its row here, and add a test with the URI bound to a
prefix of another name.
