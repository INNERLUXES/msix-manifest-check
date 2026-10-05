# 2. Read the manifest with a small reader that knows namespaces

## Status

Accepted

## Context

A package manifest is XML with many namespaces. The elements Windows reads come from the foundation namespace and from
families of extension namespaces (uap, uap2 to uap17, rescap, desktop, com and more), each a fixed URI. The prefixes are
not fixed: Visual Studio writes `uap` and `rescap`, but a manifest may bind `restricted`, `r` or `uap` to any URI it
likes, and an IgnorableNamespaces attribute names prefixes, not URIs. A check that looks for `rescap:Capability` by its
prefix misses a restricted capability written under another prefix, and reports a general capability whose prefix
happens to be `rescap`.

A full XML library would bring DTDs that declare entities, which can name files or addresses and expand into each other
until memory runs out, code the project does not review, and versions to track. The manifests the build tools write use
a small part of XML: elements, attributes, text, comments, a declaration and namespaces.

## Decision

1. The manifest is read by src/xml.js, a small reader with no dependency. It reads the text once, left to right, with a
   list of open elements of its own and no recursion, with limits of elements, depth and attributes.
2. The reader resolves every prefix to the namespace URI in scope, from the xmlns declarations of the element and its
   parents, and gives each element and attribute its local name and its namespace URI. A prefix that is not declared is
   refused with its place, as XML namespaces require. An attribute with no prefix has no namespace.
3. The checks compare namespace URIs, never prefixes. The URIs are kept in one data file, src/namespaces.js, each with
   a family; docs/inputs.md lists them, and a test checks that it lists every one.
4. The reader refuses every DOCTYPE and ENTITY declaration and every other `<!` declaration but comments and CDATA, and
   decodes only the five entities of XML and numeric references, as the OWASP page on XML external entities advises.
5. The reader keeps the offset of every element, attribute value and text, so each finding points at the line and
   column of the file. The file is decoded by its byte order mark: UTF-8 with or without one, UTF-16 with one.

## Consequences

- The tool needs no package and no network, and the same files give the same report on Linux, Windows and macOS.
- A manifest with a DOCTYPE is an `unreadable-manifest` finding, although such a manifest would be odd anyway.
- A namespace URI that is not in the table is read but its elements are passed over; adding a URI is a change to the
  data file, its row in docs/inputs.md and a test.
