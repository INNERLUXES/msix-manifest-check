// The built-in configuration: the level of every rule, the lowest Windows build a manifest should target, the
// restricted capabilities that need no warning, the protocol names that are reserved, the lowest level shown and the
// level that fails the run. docs/inputs.md describes every key, and --print-defaults writes the configuration out.

// The level of every rule that the configuration can set. The two rules of input problems are always errors.
export const DEFAULT_RULES = {
  missingIdentity: 'error',
  invalidVersion: 'error',
  invalidArchitecture: 'error',
  invalidPublisher: 'error',
  publisherMismatch: 'error',
  missingTargetDeviceFamily: 'error',
  invalidTargetVersion: 'error',
  minVersionBelowFloor: 'warning',
  restrictedCapability: 'warning',
  generalCapability: 'info',
  missingProperties: 'error',
  missingAsset: 'warning',
  invalidApplication: 'error',
  duplicateApplicationId: 'error',
  missingVisualElements: 'error',
  invalidAssociation: 'error',
  reservedProtocol: 'error',
  extensionListed: 'info',
  missingResourceLanguage: 'error',
  invalidLanguageTag: 'warning'
};

// The lowest MinVersion a TargetDeviceFamily should name, as a quad version. A MinVersion below it lets the package
// install on builds that Microsoft no longer services, which the app was most likely not tested on. The default is
// build 17763, a Windows 10 build of the long-term servicing channel; it is a number, not a date, and it does not
// move by itself. Microsoft's Windows release information page lists the builds still serviced and changes over time:
// check it and set minBuildFloor in the configuration (docs/inputs.md says how the default was chosen).
export const DEFAULT_MIN_BUILD_FLOOR = '10.0.17763.0';

// The restricted capabilities that are reported at no level, because the team has a justification for each. Empty by
// default: every restricted capability is reported.
export const DEFAULT_ALLOWED_RESTRICTED = [];

// The protocol names an app should not register. A name that ends with * is a prefix: ms-* is every name that starts
// with ms-. Windows has handlers of its own for these schemes (http, https, file, mailto and the ms- schemes of its own
// apps); this list is the tool's own choice, after the page on launching the default app for a URI.
export const DEFAULT_RESERVED_PROTOCOLS = ['http', 'https', 'file', 'ftp', 'mailto', 'microsoft-edge', 'ms-*'];

// The lowest level of a finding that is shown.
export const DEFAULT_MIN_SEVERITY = 'info';

// The lowest level of a finding that fails the run.
export const DEFAULT_FAIL_ON = 'error';
