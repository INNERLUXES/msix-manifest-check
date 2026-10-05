# Threat model

## What the tool touches

- It reads the manifests and the folders named on the command line (their top only), the folders below the root named
  with `--root` that a logo path leads to (their names only, never the content of a file), and the configuration named
  with `--config`. Nothing else is opened.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no address it reads, follows no symbolic link, expands no entity, evaluates
  nothing it reads, starts no program, opens no certificate and reads no clock.

## What the input may hold

The manifest and the assets come from a repository, and in a pipeline that checks every pull request they may be
written by whoever opened the pull request. Through them, a person can try to:

- make the tool read outside the folders or fetch something: a symbolic link or a junction in a folder, a link named on
  the command line, a file swapped for a link between the listing and the read, an external entity or a DTD in the
  manifest, a logo path with `..`, an absolute path or an address such as `ms-appx:///`, a path written as a web
  address;
- exhaust the memory, the stack or the time: manifests of megabytes, folders with thousands of entries, entities that
  expand into each other, XML nested very deep, lines of hundreds of thousands of quotes, open tags, references or
  prefixes, thousands of capabilities, applications or logo paths;
- move the result: a restricted capability under a prefix of another name, a rule set to off, a capability allowed or
  `minBuildFloor` lowered in the configuration, `failOn` raised, a manifest that only looks well formed;
- slip in something that is not text: a binary file named AppxManifest.xml, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, ANSI escapes, direction controls and line separators in
  a file name, a version, a publisher or a name;
- start a second workflow command: a text that holds `::error`, `%`, a comma, a colon or a line break, which the GitHub
  format writes into a command;
- hide a formula in the CSV report: a name, a version or a path that starts with `=`, `+`, `-` or `@`, which a
  spreadsheet may run when the report is opened;
- change how objects behave: an application Id, a capability or a protocol named `__proto__`, `constructor` or
  `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A symbolic link makes the tool read outside the folder or walk a loop | Only the top of a folder is listed, every link met is counted and none is followed, a link named on the command line or as the root is refused, and a logo path through a link is reported and not followed; each file is opened with `O_NOFOLLOW` where the system has it and its type is taken from the open handle. Tests put links to a file, to a folder and to the folder itself |
| A manifest expands entities or fetches a file or an address | The XML reader refuses every DOCTYPE, ENTITY and other `<!` declaration, and decodes only the five entities of XML and numeric references; nothing is ever expanded. Tests use an entity expansion, an external entity and a parameter entity |
| A logo path leaves the root | A path with `..`, an absolute path, a drive letter and an address are reported and not looked for; a path is resolved through listings of folders below the root, never handed to the file system whole |
| The tool fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | Manifests have a size limit checked on the open handle before they are read; folders have a limit of entries and the input a limit of manifests; the XML reader keeps a list of its own with no recursion and has limits of elements, depth and attributes; applications, capabilities and asset paths of a manifest are capped; every pattern works on short values or grows with the line; findings are capped per rule. Tests check the time, with limits that widen under coverage only |
| A pattern from the input is slow | No regular expression is built from the input or the configuration; a test looks for `new RegExp` in src |
| A prefix hides a restricted capability | Elements are found by namespace URI, never by prefix; a test writes a restricted capability under another prefix and a general one under the prefix rescap |
| The result is moved through the input or the configuration | A manifest that cannot be read and input past the limits are error findings that cannot be set off; a rule set to off is named in a note; an allowed capability is shown in the summary; the readers refuse what they do not read rather than guess. Review a change to the configuration like a change to code (docs/secure-defaults.md) |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes or a broken pair in UTF-16, and bytes that are not valid make the manifest an error finding |
| Text from the input rewrites the terminal | Every text, file names included, goes through `safeText`, which removes control, line separator and direction characters and caps the length. A test puts escapes, direction controls and line separators in a version, in every format |
| A text starts a second workflow command | The GitHub format escapes `%`, CR and LF in a message and `:` and `,` in a property; a line break never reaches a command. A test writes `%0A::error file=` and a line break with `::warning::` into a version |
| A formula runs when the CSV report is opened | A field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a single quote in front. The OWASP page on CSV injection says no one escape is safe in every program, so treat a report built from files you do not trust as untrusted data, and open it with formulas off |
| `__proto__` changes how objects behave | Names are kept in lists, maps and sets and looked up with `Object.hasOwn`; the configuration reader defines own properties. A test uses `__proto__`, `constructor` and `toString` as an application Id, a protocol and capabilities |
| A device or a pipe hangs the tool | A path that is not a regular file or folder is refused before it is read, and the listing passes over every entry that is not a file or a folder |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folders as they were |

## Out of scope

Whether the certificate is valid and trusted, what the Store will approve, the parts of the schema docs/limits.md
leaves out, who may change the configuration in your repository, and where your pipeline keeps the output.

A clean result is not a signature verification and not a Store certification.
