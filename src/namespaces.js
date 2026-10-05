// The data file of the XML namespaces of the package manifest. A manifest binds prefixes of its own choosing (uap,
// rescap, desktop, uap10 and so on) to fixed schema URIs; the tool never looks at the prefix, only at the URI it is
// bound to, so <rescap:Capability> and <restricted:Capability> are the same element when both prefixes name the URI of
// restricted capabilities. Each URI below belongs to a family, and the checks ask for a family: an element of the uap
// family is found whichever uap version declared it. docs/inputs.md lists every URI of this table, and a test checks
// that it does. A URI that is not in the table is read but belongs to no family, so the checks pass over its elements.
// The pages of the schema reference (research/sources.md) show these URIs in their Requirements tables and examples.

const MANIFEST = 'http://schemas.microsoft.com/appx/manifest';

const numbered = (family, base, numbers) => numbers.map((n) => ({ uri: `${base}/${n}`, prefix: `${family}${n}`, family }));

export const NAMESPACES = [
  { uri: `${MANIFEST}/foundation/windows10`, prefix: '(default)', family: 'foundation' },
  { uri: `${MANIFEST}/uap/windows10`, prefix: 'uap', family: 'uap' },
  ...numbered('uap', `${MANIFEST}/uap/windows10`, [2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17]),
  { uri: `${MANIFEST}/foundation/windows10/restrictedcapabilities`, prefix: 'rescap', family: 'rescap' },
  ...numbered('rescap', `${MANIFEST}/foundation/windows10/restrictedcapabilities`, [3, 6]),
  { uri: `${MANIFEST}/desktop/windows10`, prefix: 'desktop', family: 'desktop' },
  ...numbered('desktop', `${MANIFEST}/desktop/windows10`, [2, 3, 4, 5, 6, 7, 10, 11]),
  { uri: `${MANIFEST}/com/windows10`, prefix: 'com', family: 'com' },
  ...numbered('iot', `${MANIFEST}/iot/windows10`, [2])
];

const BY_URI = new Map(NAMESPACES.map((n) => [n.uri, n]));

// The family of a namespace URI ('foundation', 'uap', 'rescap', 'desktop', 'com', 'iot'), or null for a URI that is
// not in the table. The URI is compared as written, with its case, as XML compares namespace names.
export const familyOf = (uri) => BY_URI.get(uri)?.family ?? null;

// The prefix this table gives a URI, for a message, or the URI itself when it is not in the table.
export const usualPrefix = (uri) => BY_URI.get(uri)?.prefix ?? uri;

// The URI of the root element: <Package> in this namespace.
export const FOUNDATION = `${MANIFEST}/foundation/windows10`;
