import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XML_LIMITS, XML_PREFIX_URI, XmlError, attrOf, childOf, childrenOf, decodeReferences, parseXml, splitName } from '../src/index.js';
import { NS } from './helpers.js';

// The XML reader: well-formed XML, namespaces resolved by URI, no DTD and no entity of its own, and the place of every
// problem.

const refused = (text, limits) => {
  try {
    parseXml(text, limits);
  } catch (error) {
    assert.ok(error instanceof XmlError, error.message);
    return error;
  }
  return assert.fail('not refused');
};

test('xml: elements, attributes, text, CDATA, comments and processing instructions, with their places', () => {
  const text = '<?xml version="1.0"?>\n<!-- c -->\n<a x="1" y=\'2\'><b>t &amp; u</b><![CDATA[<raw>]]><c/></a>\n';
  const root = parseXml(text);
  assert.equal(root.name, 'a');
  assert.equal(root.offset, text.indexOf('<a'));
  assert.deepEqual(root.attrs.map((a) => [a.name, a.value, a.offset]), [['x', '1', text.indexOf('1"')], ['y', '2', text.indexOf("2'")]]);
  assert.equal(root.children[0].text, 't & u');
  assert.equal(root.children[0].textOffset, text.indexOf('t &'));
  assert.equal(root.text, '<raw>');
  assert.equal(root.children[1].name, 'c');
  assert.equal(parseXml('\ufeff<a/>').name, 'a');
});

test('xml: names are resolved to the namespace URI in scope, whatever the prefix', () => {
  const text = `<Package xmlns="${NS.foundation}" xmlns:u="${NS.uap}"><u:VisualElements u:Extra="1" Plain="2"/><Inner xmlns="${NS.uap}" xmlns:u="${NS.rescap}"><u:Capability/></Inner><Again/></Package>`;
  const root = parseXml(text);
  assert.deepEqual([root.prefix, root.local, root.uri], ['', 'Package', NS.foundation]);
  const ve = root.children[0];
  assert.deepEqual([ve.prefix, ve.local, ve.uri], ['u', 'VisualElements', NS.uap]);
  assert.equal(attrOf(ve, 'Extra', NS.uap).value, '1');
  assert.equal(attrOf(ve, 'Plain').value, '2', 'an attribute with no prefix has no namespace');
  assert.equal(attrOf(ve, 'Plain', NS.foundation), undefined);
  const inner = root.children[1];
  assert.equal(inner.uri, NS.uap, 'a default namespace declared inside');
  assert.equal(inner.children[0].uri, NS.rescap, 'a prefix declared again inside');
  assert.equal(root.children[2].uri, NS.foundation, 'the scope ends with the element');
  assert.equal(childOf(root, 'VisualElements', (u) => u === NS.uap), ve);
  assert.equal(childOf(root, 'VisualElements', (u) => u === NS.foundation), undefined);
  assert.equal(childrenOf(root, 'Again', () => true).length, 1);
  assert.equal(parseXml('<a xml:lang="en"/>').attrs[0].uri, XML_PREFIX_URI);
  assert.equal(parseXml('<a xmlns=""><b/></a>').children[0].uri, '');
});

test('xml: namespace mistakes are refused with their place', () => {
  assert.match(refused('<u:a/>').reason, /the prefix u of <u:a> is not declared/);
  assert.match(refused('<a u:x="1"/>').reason, /the prefix u of the attribute u:x is not declared/);
  assert.match(refused('<a xmlns:u=""/>').reason, /declared with an empty namespace/);
  assert.match(refused('<a xmlns:xmlns="x"/>').reason, /the prefix xmlns cannot be declared/);
  assert.match(refused('<xmlns:a/>').reason, /not declared|cannot use the prefix xmlns/);
  assert.match(refused('<a:b:c xmlns:a="x"/>').reason, /not a prefix and a local name/);
  assert.match(refused('<a xmlns:p="x" xmlns:q="x" p:k="1" q:k="2"/>').reason, /the attribute k of one namespace appears twice/);
  assert.equal(refused('<r>\n<u:a/></r>').offset, 4);
  assert.deepEqual(splitName('a', 0), { prefix: '', local: 'a' });
  assert.throws(() => splitName(':a', 0), /not a prefix and a local name/);
});

test('xml: a DOCTYPE, an ENTITY declaration and any entity of its own are refused, before anything is expanded', () => {
  assert.match(refused('<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>').reason, /a DOCTYPE declaration; the tool refuses DTDs/);
  assert.match(refused('<a><!ENTITY x "y"></a>').reason, /an ENTITY declaration/);
  assert.match(refused('<a><!ELEMENT a ANY></a>').reason, /a declaration; the tool refuses <! declarations/);
  assert.match(refused('<a>&x;</a>').reason, /the entity &x; is not one of the five of XML/);
  assert.match(refused('<a>a & b</a>').reason, /an & that does not start a reference/);
  assert.match(refused('<a>&#0;</a>').reason, /names no character XML allows/);
  assert.match(refused('<a>&#xD800;</a>').reason, /names no character XML allows/);
  assert.equal(decodeReferences('&lt;&#65;&#x42;&apos;', 0), "<AB'");
});

test('xml: what is not well formed is refused with its place', () => {
  const cases = [['<a>', /the element <a> is not closed/], ['<a></b>', /does not match/], ['</a>', /with no open element/], ['<a/><b/>', /a second root element/], ['x<a/>', /text outside the root/], ['<a x="1" x="2"/>', /appears twice/], ['<a x=1/>', /not in quotes/], ['<a x/>', /has no value/], ['<a x="1/>', /is not closed|not closed/], ['<a x="<"/>', /a < inside the value/], ['<a><</a>', /does not start a tag/], ['<a>', /not closed/], ['', /holds no element/], ['<!-- x', /comment that is not closed/], ['<a><![CDATA[x</a>', /CDATA section that is not closed/], ['<![CDATA[x]]><a/>', /outside the root/], ['<?xml', /processing instruction that is not closed/], ['<a b="1"c="2"/>', /not name="value"/], ['<a></a  x>', /not ended by >/]];
  for (const [text, reason] of cases) assert.match(refused(text).reason, reason, text);
  const wrong = '<r>\n  <a></b></r>';
  assert.equal(refused(wrong).offset, wrong.indexOf('</b>'));
});

test('xml: the limits of elements, depth and attributes', () => {
  assert.match(refused('<a><b/><b/><b/></a>', { maxElements: 3 }).reason, /more than 3 elements/);
  assert.match(refused('<a><b><c></c></b></a>', { maxDepth: 2 }).reason, /nested more than 2 deep/);
  assert.match(refused('<a x="1" y="2"/>', { maxAttributes: 1 }).reason, /more than 1 attributes/);
  assert.equal(XML_LIMITS.maxDepth, 64);
});
