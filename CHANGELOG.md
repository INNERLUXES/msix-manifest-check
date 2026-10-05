# Changes

## 1.0.0

First release.

- Checks the package manifest of a Windows app packaged with MSIX (Package.appxmanifest or AppxManifest.xml) from the
  files on disk before a Microsoft Store or sideload release: named one by one or as folders read at their top. Fetches
  nothing, opens no certificate, follows no symbolic link and reads no clock.
- A small XML reader of its own with no dependency that resolves every prefix to its namespace URI, so the checks find
  elements by URI and never by prefix; the URIs are kept in one documented data file. It refuses every DOCTYPE and
  ENTITY declaration and every entity other than the five of XML, has limits of size, elements, depth and attributes,
  and reads UTF-8 with or without a byte order mark and UTF-16 with one.
- Twenty rules in three levels: an identity with a part missing (`missing-identity`), a version that is not four 16-bit
  numbers (`invalid-version`), a processor architecture that is not valid (`invalid-architecture`), a publisher that is
  not a distinguished name (`invalid-publisher`) or not the subject given with `--cert-subject`
  (`publisher-mismatch`), a TargetDeviceFamily that is missing (`missing-target-device-family`), with versions that are
  not valid or a MinVersion above MaxVersionTested (`invalid-target-version`) or below a configurable build floor
  (`min-version-below-floor`), restricted capabilities that need a justification at Store submission
  (`restricted-capability`), general, device and custom capabilities listed for review (`general-capability`),
  properties with a part missing (`missing-properties`), logos and images not under `--root`, with or without
  qualifiers such as .scale-200 (`missing-asset`), applications that cannot be started (`invalid-application`) or
  share an Id (`duplicate-application-id`), visual elements with a part missing (`missing-visual-elements`), protocol
  and file type names that are not valid (`invalid-association`) or reserved (`reserved-protocol`), startup tasks,
  full-trust processes, app services and COM servers listed with what they imply (`extension-listed`), and resource
  languages that are missing (`missing-resource-language`) or not well-formed BCP 47 tags (`invalid-language-tag`);
  and two rules of input problems that cannot be lowered (`unreadable-manifest`, `scan-limit`).
- A summary of each manifest: its identity, version, the Windows builds it targets and tested, its capabilities by
  group, its applications, extensions and languages.
- A configuration file in strict JSON over documented defaults: the level of every rule, the build floor, the
  restricted capabilities that are allowed, the reserved protocol names, the minimum severity and the level that fails
  the run; a key the tool does not know is an error with its line and a suggestion, and a key named twice is refused.
- Reports as text, JSON, CSV with one row per finding (`--format csv`) and GitHub workflow commands (`--format github`)
  that show each finding as an annotation; every finding has its file, line and column; `--min-severity`, `--fail-on`,
  `--explain` with the rule, the sources and the tool's own choice, and `--print-defaults`. Exit code `0` when no
  finding is at or above the fail-on level, `1` when one is, `2` for a usage or input error, with no result.
- A check before the release, not a signature verification and not a Store certification: every report says so.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
