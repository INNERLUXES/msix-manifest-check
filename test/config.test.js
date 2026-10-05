import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, DEFAULT_ALLOWED_RESTRICTED, DEFAULT_MIN_BUILD_FLOOR, DEFAULT_RESERVED_PROTOCOLS, DEFAULT_RULES, KEYS, defaultConfig, defaultsAsConfig, distance, isCapabilityName, isObject, isProtocolEntry, kindOf, readConfig, suggestion, validateConfig } from '../src/index.js';
import { PACKAGE, configOf, goodWith, packageWith, run } from './helpers.js';

// The configuration file: every key with a good value and a bad one, unknown keys with their line and a suggestion,
// and a key named twice refused.

const problems = (text) => {
  try {
    readConfig(text, 'c.json');
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.problems;
  }
  return [];
};

test('config: the defaults, and --print-defaults read back give the same configuration', () => {
  const d = defaultConfig();
  assert.deepEqual(d.rules, DEFAULT_RULES);
  assert.equal(d.minBuildFloor, DEFAULT_MIN_BUILD_FLOOR);
  assert.equal(d.minBuildFloor, '10.0.17763.0');
  assert.deepEqual(d.allowedRestrictedCapabilities, DEFAULT_ALLOWED_RESTRICTED);
  assert.deepEqual(d.reservedProtocols, DEFAULT_RESERVED_PROTOCOLS);
  assert.equal(d.minSeverity, 'info');
  assert.equal(d.failOn, 'error');
  const back = readConfig(JSON.stringify(defaultsAsConfig()), 'd.json');
  assert.deepEqual({ ...back, file: null, name: null }, d);
  assert.deepEqual(Object.keys(KEYS), ['name', 'rules', 'minBuildFloor', 'allowedRestrictedCapabilities', 'reservedProtocols', 'minSeverity', 'failOn']);
});

test('config: every key with a good value is taken', () => {
  const c = configOf({ name: 'Release review', rules: { restrictedCapability: 'error', generalCapability: 'off' }, minBuildFloor: '10.0.19041.0', allowedRestrictedCapabilities: ['runFullTrust', 'runFullTrust'], reservedProtocols: ['kestrel-*', 'https'], minSeverity: 'warning', failOn: 'warning' });
  assert.equal(c.name, 'Release review');
  assert.equal(c.rules.restrictedCapability, 'error');
  assert.equal(c.rules.generalCapability, 'off');
  assert.equal(c.minBuildFloor, '10.0.19041.0');
  assert.deepEqual(c.allowedRestrictedCapabilities, ['runFullTrust'], 'a name given twice is kept once');
  assert.deepEqual(c.reservedProtocols, ['kestrel-*', 'https']);
  assert.equal(c.minSeverity, 'warning');
  assert.equal(c.failOn, 'warning');
  assert.deepEqual(configOf({ reservedProtocols: [] }).reservedProtocols, [], 'an empty list turns the check off');
});

test('config: an unknown key is an error with its line and a suggestion, at the top and in rules', () => {
  assert.deepEqual(problems('{\n  "failOm": "error"\n}'), ['c.json: line 2: "failOm" is not a key of the configuration; did you mean "failOn"?']);
  assert.deepEqual(problems('{\n  "rules": {\n    "restrictedCapabilty": "off"\n  }\n}'), ['c.json: line 3: "restrictedCapabilty" is not a key of rules; did you mean "restrictedCapability"?']);
  assert.deepEqual(problems('{"minBuildFlor": "10.0.0.0"}'), ['c.json: line 1: "minBuildFlor" is not a key of the configuration; did you mean "minBuildFloor"?']);
  assert.deepEqual(problems('{"colour": 1}'), ['c.json: line 1: "colour" is not a key of the configuration']);
});

test('config: a value of the wrong kind is an error, and all problems are listed in the order of their lines', () => {
  const p = problems('{\n  "name": "",\n  "rules": {"missingAsset": "loud", "invalidVersion": 3},\n  "minBuildFloor": "10.0.17763",\n  "allowedRestrictedCapabilities": ["run full trust", 5],\n  "reservedProtocols": ["MS-*", "ms*x"],\n  "minSeverity": "fatal",\n  "failOn": null\n}');
  assert.deepEqual(p, [
    'c.json: line 2: name must be a text of 1 to 120 characters',
    'c.json: line 3: rules.missingAsset must be one of info, warning, error, off, not "loud"',
    'c.json: line 3: rules.invalidVersion must be one of info, warning, error, off, not 3',
    'c.json: line 4: minBuildFloor must be a quad version such as "10.0.17763.0", not "10.0.17763": it has 3 parts, not four (major.minor.build.revision)',
    'c.json: line 5: allowedRestrictedCapabilities[0]: "run full trust" is not the name of a capability, such as runFullTrust',
    'c.json: line 5: allowedRestrictedCapabilities[1] must be a text, not a number',
    'c.json: line 6: reservedProtocols[0]: "MS-*" is not a lowercase protocol name, or the start of one followed by *, such as ms-*',
    'c.json: line 6: reservedProtocols[1]: "ms*x" is not a lowercase protocol name, or the start of one followed by *, such as ms-*',
    'c.json: line 7: minSeverity must be one of info, warning, error',
    'c.json: line 8: failOn must be one of info, warning, error'
  ]);
  assert.deepEqual(problems('{"rules": []}'), ['c.json: line 1: rules must be an object, not a list']);
  assert.deepEqual(problems('{"minBuildFloor": 17763}'), ['c.json: line 1: minBuildFloor must be a quad version such as "10.0.17763.0", not a number']);
  assert.deepEqual(problems('{"reservedProtocols": "ms-*"}'), ['c.json: line 1: reservedProtocols must be a list, not a string']);
  assert.deepEqual(problems(`{"allowedRestrictedCapabilities": ${JSON.stringify(Array(CONFIG_LIMITS.maxListEntries + 1).fill('runFullTrust'))}}`), [`c.json: line 1: allowedRestrictedCapabilities holds more than ${CONFIG_LIMITS.maxListEntries} entries`]);
});

test('config: JSON that is not strict, a name given twice and a value that is not an object are refused', () => {
  assert.match(problems('{"failOn": "error",}')[0], /c\.json: line 1, column 20: a comma before the closing brace/);
  assert.match(problems('{"failOn": "error", "failOn": "info"}')[0], /appears twice in one object/);
  assert.match(problems('// comment\n{}')[0], /a comment; JSON has no comments/);
  assert.deepEqual(problems('[]'), ['c.json: line 1: the configuration must be a JSON object, not a list']);
  assert.throws(() => validateConfig('x'), ConfigError);
});

test('config: the suggestion and the name checks', () => {
  assert.equal(distance('nmae', 'name'), 1);
  assert.equal(suggestion('x'.repeat(70), ['name']), '');
  assert.equal(suggestion('zzzzzz', ['name']), '');
  assert.equal(kindOf(null), 'null');
  assert.equal(kindOf({}), 'an object');
  assert.ok(isObject({}) && !isObject([]));
  assert.ok(isCapabilityName('broadFileSystemAccess'));
  assert.ok(!isCapabilityName('1abc') && !isCapabilityName('a-b'));
  assert.ok(isProtocolEntry('ms-*') && isProtocolEntry('mailto'));
  assert.ok(!isProtocolEntry('*') && !isProtocolEntry('Mailto') && !isProtocolEntry('a*b'));
});

test('config: through a run, a rule set to off gives no finding and a note, and a bad configuration stops the run with exit code 2', async () => {
  const caps = goodWith(['</Package>', '<Capabilities><Capability Name="internetClient" /></Capabilities></Package>']);
  const r = await run(packageWith({ 'pkg/Package.appxmanifest': caps, 'c.json': '{"rules": {"generalCapability": "off"}}' }), ['pkg/Package.appxmanifest', '--root', 'pkg', '--config', 'c.json']);
  assert.equal(r.code, 0);
  assert.match(r.out, /findings: 0\n/);
  assert.match(r.out, /note: 1 rule is off: general-capability\n/);
  const bad = await run({ ...PACKAGE, 'c.json': '{"failon": "info"}' }, ['pkg/Package.appxmanifest', '--config', 'c.json']);
  assert.equal(bad.code, 2);
  assert.equal(bad.out, '');
  assert.match(bad.err, /^msix-manifest-check: no result, the input has a problem:\n {2}c\.json: line 1: "failon" is not a key of the configuration; did you mean "failOn"\?\n$/);
  const missing = await run(PACKAGE, ['pkg/Package.appxmanifest', '--config', 'none.json']);
  assert.match(missing.err, /none\.json: no such file or folder/);
});
