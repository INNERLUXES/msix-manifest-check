# Limits

The tool reads the package manifest of a Windows app (Package.appxmanifest or AppxManifest.xml) from disk, and the
asset files beside it when `--root` names their folder. It is a check to run before a Store or sideload release, not a
signature verification and not a Store certification. It fetches nothing, runs nothing, connects to no system and asks
nobody anything. A finding points at a line where a problem was found, and a run without findings says only that the
manifest holds none of the problems of docs/method.md. Every report ends with a sentence that says so.

## What it cannot see

- **The certificate.** The tool never opens a certificate. `--cert-subject` is text the pipeline passes in; whether the
  certificate with that subject exists, is valid, is trusted, has the code signing usage or is about to expire is not
  checked. Signing with SignTool is the check of that.
- **The Store.** Whether Partner Center reserved the Name and Publisher, whether a restricted capability will be
  approved, and whether the package passes the certification tests are not known. A restricted capability is reported
  as needing a justification, not as refused.
- **The whole schema.** The tool checks the parts of docs/method.md, not every element and attribute of the schema;
  MakeAppx validates the schema when it builds the package. Unknown elements, the order of elements, the values of
  BackgroundColor, the device family names, package-level extensions, dependencies on other packages and the
  activation attributes beyond those of `invalid-application` are not checked.
- **The images.** Asset files are found by name only; their size, format, scale and whether they are images at all are
  not checked. A resource reference such as `ms-resource:AppName` in a text is not resolved.
- **Time.** The tool reads no clock and no dates ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)),
  so a build that falls out of Microsoft's servicing is reported only once `minBuildFloor` is raised.
- **Namespaces.** Elements are found by namespace URI, never by prefix
  ([decision 2](decisions/0002-read-the-manifest-with-a-small-reader-that-knows-namespaces.md)); a namespace URI that is
  not in the table of src/namespaces.js belongs to no family, so its elements are passed over.
- **Language registry.** A language tag is checked for its form only; whether its subtags are in the IANA registry is
  not, so `xx-QQ` is well formed.
- **Whether a finding matters to you.** A general capability may be needed, a startup task may be wanted, and an old
  build may be supported on purpose. Set the level of a rule, or turn it off, in the configuration.

## The readers

- The XML reader refuses a DOCTYPE, an ENTITY declaration, every entity other than the five of XML, a prefix that is
  not declared and a file that is not well formed.
- A manifest is read as UTF-8, with or without a byte order mark, or as UTF-16 with its byte order mark; UTF-16 with no
  mark, and any other encoding, is an `unreadable-manifest` finding. The encoding attribute of the XML declaration is not
  read.
- The JSON reader of the configuration is strict: no comments, no trailing comma, no name given twice.

## Size limits

Past a limit, the input is refused with exit code `2` and no result, a manifest is an error finding, or the listing
stops with a `scan-limit` finding.

| What | Limit |
| --- | --- |
| a manifest | 2 MB; a larger one is an `unreadable-manifest` finding |
| the configuration | 1 MB |
| files and folders named | 100 |
| entries of a folder (manifests or assets) | 10,000 |
| manifests in all | 200 |
| elements of a manifest | 20,000, nested up to 64 deep, with up to 256 attributes a tag |
| applications of a manifest | 100 read |
| capabilities of a manifest | 1,000 read |
| asset paths of a manifest | 500 looked for |
| folders of qualifiers looked in for one asset | 50 |
| a version | 64 characters |
| a publisher | 8,192 characters |
| a language tag | 128 characters |
| findings of one rule | 500 listed; the rest are counted in a note and still count for the result |
| problems of the input | 20 listed; the rest are counted |

The tests check manifests of five thousand capabilities and three hundred applications, XML of nineteen thousand
elements, runs of hundreds of thousands of open tags, quotes, references and prefixes, an entity expansion and an
external entity, nesting thousands deep, more than two hundred manifests in one folder and values of two hundred
thousand characters, each with a time check.
