import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gatewayAddress } from '../src/data/gateway';
test('native Expo Go may use a private LAN address; remote connections require HTTPS', () => {
  assert.equal(gatewayAddress('http://192.168.1.20:8000/', true), 'http://192.168.1.20:8000');
  assert.equal(gatewayAddress('http://10.12.1.2:8000', true), 'http://10.12.1.2:8000');
  assert.equal(gatewayAddress('https://agent.example.com/'), 'https://agent.example.com');
  for (const [url, lan] of [['http://192.168.1.20:8000',false],['http://8.8.8.8',true],['https://user:secret@example.com',true],['https://example.com?token=secret',true],['javascript:alert(1)',true]] as const)
    assert.throws(() => gatewayAddress(url, lan));
});
