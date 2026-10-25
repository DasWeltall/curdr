/** LAN HTTP is permitted only for private addresses in the native Android app. */
export function gatewayAddress(value: string, allowLan = false) {
  let u: URL;
  try { u = new URL(value.trim()); } catch { throw Error('Enter a complete server URL.'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
    throw Error('Use an HTTP(S) URL without credentials or query parameters.');
  const octets = u.hostname.split('.').map(Number);
  const ipv4 = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  const lan = ipv4 && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31);
  if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && !(allowLan && (lan || /^[a-z0-9-]+\.local$/i.test(u.hostname))))
    throw Error('Use HTTPS for remote servers. The Android app can connect to a private LAN address on the same Wi-Fi.');
  return u.toString().replace(/\/$/, '');
}
