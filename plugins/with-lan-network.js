const { withAndroidManifest } = require('expo/config-plugins');
// Native transport separately restricts HTTP to explicit private LAN/loopback hosts.
module.exports = config => withAndroidManifest(config, config => {
  const application = config.modResults.manifest.application?.[0];
  if (application) application.$['android:usesCleartextTraffic'] = 'true';
  return config;
});
