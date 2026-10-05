# Oakhollow Notes: a manifest in good order

A made-up company packages its notes app with MSIX. `Package.appxmanifest` names the publisher
`CN=Oakhollow Labs, O=Oakhollow Labs Ltd, L=Galway, C=IE`, the subject of the certificate it signs with, a version of
four parts, the Windows.Desktop device family from build 19041 to build 22621, three resource languages, one
application with all its visual elements, a protocol and a file type association of its own, and no capability.

`Assets/` holds every image the manifest names, in the forms Windows accepts: the StoreLogo plain, the
Square150x150Logo and SplashScreen with scale qualifiers in their names, the Square44x44Logo with a targetsize and an
altform qualifier, and the Wide310x150Logo in a `scale-200` folder.

```
node bin/msix-manifest-check.js examples/clean/Package.appxmanifest --root examples/clean --cert-subject "CN=Oakhollow Labs, O=Oakhollow Labs Ltd, L=Galway, C=IE"
```

The files in `Assets/` are short text files that stand in for the images; they are not pictures.
