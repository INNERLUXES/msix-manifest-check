# 3. Check the files on disk, and fetch nothing

## Status

Accepted

## Context

Some facts about a manifest live elsewhere: the subject of the signing certificate is in a certificate store or a
.pfx file, the identity the Store reserved is in Partner Center, the logos are in the project, and the builds Microsoft
services are on a web page. A check could open the certificate, call Partner Center, fetch the page or run MakeAppx to
validate the schema. Each would need secrets, a network, Windows or the SDK, and would make the result depend on the
state of a server; a manifest in a pull request could make the pipeline reach an address it names.

What matters before a release is what is about to be packed and signed: the manifest and the files beside it.

## Decision

1. The tool reads the manifests, the folder named with `--root` and the configuration, and nothing else. It fetches
   nothing, opens no certificate, runs no program and calls no service.
2. The subject of the signing certificate is given as text with `--cert-subject`; the pipeline reads it from the
   certificate it signs with and passes it in, so no secret reaches the tool.
3. With `--root`, each logo path of the manifest is looked for under the root, through listings of folders that follow
   no link, with the case of names ignored and the qualifiers of the resource system (`.scale-200`, `scale-200/`)
   accepted. The images are not opened; their size and format are not checked.
4. Without `--root` or `--cert-subject`, those checks do not run, and the report says so in a note.

## Consequences

- The result depends only on the files and the text given, and a run needs no network access, no secret and no
  Windows machine.
- Whether the certificate is valid, trusted or about to expire, whether the Store reserved the name, and whether the
  images have the right sizes are not checked (docs/limits.md).
- A subject passed by hand can be out of date; docs/secure-defaults.md asks to read it from the certificate in the same
  job.
