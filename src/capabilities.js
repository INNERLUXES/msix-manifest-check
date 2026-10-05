// What the tool says about the capabilities and extensions a manifest declares, in this project's own words, after
// the app capability declarations page and the pages on packaging extensions (research/sources.md). A capability is
// put in its group by its element and the namespace family of that element (src/namespaces.js), never by its name or
// its prefix: <Capability> of the foundation or uap family is general, <Capability> of the rescap family is
// restricted, <DeviceCapability> is a device capability and <CustomCapability> is a custom one. A name that is not
// below is still reported in its group, with no note.

export const RESTRICTED_NOTES = {
  runFullTrust: 'the package holds full-trust code, such as a packaged desktop app, that runs at medium integrity outside the app container',
  broadFileSystemAccess: 'the app can reach every file the signed-in user can, with no file picker; the Store asks why the pickers and the future access list are not enough',
  allowElevation: 'the app can run with administrator rights; the Store approves it only under strict criteria, with a detailed justification asked for before the submission',
  packageManagement: 'the app can install, update and remove other apps directly',
  unvirtualizedResources: 'the app can turn off the virtualization of file system and registry writes, so what it writes is shared with other apps and stays after it is removed',
  localSystemServices: 'the app installs services that run as Local System',
  customInstallActions: 'the app runs actions of its own when it is installed, updated or removed',
  packageWriteRedirectionCompatibilityShim: 'new files the app writes go to a location of each user',
  inputInjectionBrokered: 'the app can inject input such as touch, mouse and keyboard into the system',
  deviceUnlock: 'the app can open a locked device for developer and enterprise sideloading; the Store rarely approves it',
  appCaptureSettings: 'the app can change the settings of app capture',
  enterpriseDataPolicy: 'the app can set and read the data protection policy of an enterprise'
};

export const GENERAL_NOTES = {
  internetClient: 'outgoing connections to the internet and public networks',
  internetClientServer: 'incoming connections from the internet as well as outgoing ones, so the app can act as a server',
  privateNetworkClientServer: 'incoming and outgoing connections on home and work networks, through the firewall',
  documentsLibrary: 'the Documents library, for the file types the manifest declares',
  picturesLibrary: 'the Pictures library',
  videosLibrary: 'the Videos library',
  musicLibrary: 'the Music library',
  removableStorage: 'files on removable storage, for the file types the manifest declares',
  enterpriseAuthentication: 'the credentials of the user on a domain',
  sharedUserCertificates: 'the certificates of the user and smart cards',
  userAccountInformation: 'the name and picture of the user',
  appointments: 'the appointments of the user',
  contacts: 'the contacts of the user',
  phoneCall: 'the phone lines of the device',
  allJoyn: 'AllJoyn devices and apps on the network'
};

export const DEVICE_NOTES = {
  webcam: 'the video feed of the camera; users can turn the access off in the privacy settings',
  microphone: 'the audio feed of the microphone; users can turn the access off in the privacy settings',
  location: 'the location of the device from GPS or the network; users can turn location off',
  bluetooth: 'paired Bluetooth devices',
  proximity: 'devices close by, through near field communication'
};

// What an application extension implies, by its Category. Protocols and file type associations are checked by their
// own rules and are not listed here.
export const EXTENSION_NOTES = {
  'windows.startupTask': 'a startup task: an executable that starts when the user signs in, unless the user turns it off',
  'windows.fullTrustProcess': 'a full-trust process: the package starts a process at medium integrity, which needs runFullTrust',
  'windows.appService': 'an app service: other apps can call a service of this app by its name',
  'windows.comServer': 'a COM server: the package registers out-of-process COM classes that other processes can create, which needs runFullTrust',
  'windows.appExecutionAlias': 'an execution alias: the app can be started by a name typed in a command prompt',
  'windows.firewallRules': 'firewall rules: the package opens ports in the Windows firewall when it is installed'
};

// The group of a capability element, from its local name and the family of its namespace, or null.
export function groupOf(local, family) {
  if (local === 'Capability') {
    if (family === 'rescap') return 'restricted';
    if (family === 'foundation' || family === 'uap') return 'general';
    return null;
  }
  if (local === 'DeviceCapability' && family === 'foundation') return 'device';
  if (local === 'CustomCapability' && family === 'uap') return 'custom';
  return null;
}

export const GROUPS = ['restricted', 'general', 'device', 'custom'];

// The note on a capability of a group, or ''.
export function capabilityNote(group, name) {
  const table = group === 'restricted' ? RESTRICTED_NOTES : group === 'general' ? GENERAL_NOTES : group === 'device' ? DEVICE_NOTES : null;
  return table && Object.hasOwn(table, name) ? table[name] : '';
}
