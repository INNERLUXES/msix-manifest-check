# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which files you give it, where the output goes, and who may
change the configuration. A clean result is not a signature verification and not a Store certification; it is a
manifest with none of the problems the rules look for, not a finding that the package is safe to ship.

## How the tool behaves by default

- **Reads, never fetches.** The tool reads the manifests, the root folder and the configuration it is given. It follows
  no symbolic link, fetches no address, refuses an argument that looks like an address, expands no entity, runs
  nothing it reads, evaluates nothing, starts no program, opens no certificate and writes nothing to disk.
- **Every rule on from the first run.** An identity with a part missing, a version that is not four 16-bit numbers, a
  processor architecture or publisher that is not valid, a publisher that is not the certificate subject, device family
  versions that are missing, not valid or in the wrong order, properties and visual elements with a part missing,
  applications that cannot start or share an Id, invalid or reserved protocol and file type names and a missing
  language are errors; a build below the floor, a restricted capability, a missing logo and a language tag that is not
  well formed are warnings; general capabilities and extensions are listed as notes.
- **Fail closed on what it cannot read.** A manifest that cannot be read and input past the limits of a run are error
  findings that fail the run at the default `failOn` of `error`; these two rules have no key and cannot be lowered or
  set off. A path that cannot be used, a root that is not a folder and a certificate subject that is not a
  distinguished name stop the run with exit code `2` and no result.
- **No DTD, no entity.** The XML reader refuses a DOCTYPE, an ENTITY declaration and every entity other than the five of
  XML, as the OWASP page on XML external entities advises.
- **Namespaces by URI.** A restricted capability is found by its namespace URI under any prefix, so a prefix of another
  name cannot hide one.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and
  a suggestion, so a typo such as `failOm` cannot leave a default in place. A key named twice stops the run.
- **No regular expression from the input.** No pattern is built from a file or the configuration.
- **No recursion.** The listing of a folder and the readers keep lists of their own, so a deep file cannot exhaust the
  stack.
- **No prototype tricks.** Names from the input are looked up in lists, maps and sets or with `Object.hasOwn`, and the
  configuration reader defines own properties, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names included, has control characters, line separators and direction
  controls removed and its length capped before it reaches a report or an error message. The GitHub format escapes
  `%`, CR and LF in a message and also `:` and `,` in a property. The CSV format puts a single quote in front of a field
  that a spreadsheet could read as a formula.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--cert-subject` on every run.** Read the subject from the certificate the signing step uses, in the same job, and
  pass it in, so a publisher that does not match is caught before SignTool fails.
- **`--root` on every run.** Point it at the folder the package is built from, so a logo that is missing is caught.
- **`"failOn": "warning"`.** A build below the floor, a restricted capability that is not allowed, a missing logo and
  a language tag that is not well formed fail the run too.
- **`allowedRestrictedCapabilities`.** Keep it to the capabilities the Store approved for the app, and review a change
  to it like a change to code.
- **`minBuildFloor`.** Keep it at the oldest build the team tests, after Microsoft's release information page.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: MSIX manifest check
    run: npx --yes github:INNERLUXES/msix-manifest-check App.Package/Package.appxmanifest --root App.Package --cert-subject "$CERT_SUBJECT" --format github
```

- Give the job read access to the contents and nothing more. The tool needs no secret: the subject of a certificate is
  not a secret, and the private key never reaches it.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Do not hide the exit code with a trailing `|| true`. To see the report without failing, keep `failOn` at `error` and
  keep the JSON or CSV report as an artifact of the job.
- Treat a CSV report built from files you do not trust as untrusted data: open it with formulas off.
- Run the check on the manifest that is packed: the source Package.appxmanifest before the build, or AppxManifest.xml
  of the layout after it.

## Protecting the configuration

The configuration decides which rules report, which restricted capabilities are allowed, which protocols are reserved,
the build floor and what fails the run. Keep it in the repository, put its path in `CODEOWNERS` with the people who own
the releases, and require their review in branch protection. Review a change that sets a rule to off or lower, allows
a restricted capability, empties `reservedProtocols`, lowers `minBuildFloor` or raises `failOn` like a change to code:
each of them can hide a gap.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
