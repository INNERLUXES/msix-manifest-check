# Brindlecote Ledger: a manifest before the release review

A made-up software company packages its desktop accounting app with MSIX for the Microsoft Store and for sideloading.
`Package.appxmanifest` is the manifest of its packaging project as it stood before the release review, and `Assets/`
holds the images the project ships. The certificate Brindlecote signs with has the subject
`CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB`. The manifest has gone wrong in the ways that stop a
signing step or a Store submission:

- the Publisher says `CN=Brindlecote Software`, not the subject of the certificate, so signing fails;
- the Version is `4.2.70000.0`, a pipeline build number that does not fit in 16 bits;
- the Windows.Desktop device family has a MinVersion of build 22631 above its MaxVersionTested of build 19045, and the
  Windows.Universal one a MinVersion of build 16299, below the floor of build 17763;
- the capabilities hold runFullTrust and broadFileSystemAccess, which need a justification at Store submission, under
  the prefix `restricted` instead of the usual `rescap`; the namespace URI is what counts;
- the Square44x44Logo is not in `Assets/`, while the StoreLogo and Square150x150Logo are there with their scale
  qualifiers;
- the protocol is named `ms-ledger`, a name of the `ms-` schemes of Windows, and the file type association is named
  `Ledger Book`, with capitals and a space;
- a second application reuses the Id `App`, has no EntryPoint and no Description;
- the second resource language is `en_IE`, with an underscore.

It also holds what must not be reported: logos found with their qualifiers, a well-formed language tag and a startup
task, which is only listed. `../config.json` names the review, keeps the default build floor and adds a protocol of
the company's own to the reserved names.

```
node bin/msix-manifest-check.js examples/messy/Package.appxmanifest --root examples/messy --cert-subject "CN=Brindlecote Software Ltd, O=Brindlecote Ltd, L=Leeds, C=GB" --config examples/config.json
```

The files in `Assets/` are short text files that stand in for the images; they are not pictures.
