import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromDb, summarizePeaks, validPeaks, audioTime } from '../src/data/audio';
import { personalProfile } from '../src/data/profile';
import { defaults } from '../src/data/seed';
import { gatewayAddress } from '../src/data/gateway';
test('waveforms preserve real silence, peaks and relative microphone volume', () => {
  assert.equal(levelFromDb(undefined), 0);
  assert.equal(levelFromDb(-160), 0);
  assert.equal(levelFromDb(NaN), 0);
  assert.equal(levelFromDb(0), 1);
  assert.ok(levelFromDb(-15) > levelFromDb(-35));
  assert.deepEqual(summarizePeaks([0, 0, 0, 0], 2), [0, 0]);
  assert.deepEqual(summarizePeaks([.1, .8, 0, .3], 2), [.8, .3]);
  assert.deepEqual(validPeaks([NaN, -1, .5, Infinity, 2]), [0, 0, .5, 0, 1]);
  assert.equal(validPeaks(Array(1300).fill(.5)).length, 1200);
  assert.equal(audioTime(62.9), '1:02');
});
test('profile transfer copies appearance without overriding server controls', () => {
  const profile = personalProfile({ ...defaults, name: 'Sam', pic: 'photo', icon: 'ring', budget: 999, model: 'other', sbx: false });
  assert.equal(profile.name, 'Sam'); assert.equal(profile.pic, 'photo'); assert.equal(profile.icon, 'ring');
  assert.ok(!('budget' in profile)); assert.ok(!('model' in profile)); assert.ok(!('sbx' in profile));
  assert.equal(profile.onboarded, true);
});
test('release Android allows private LAN and mDNS while browser and public HTTP stay restricted', () => {
  assert.equal(gatewayAddress('http://hermes.local:8000', true), 'http://hermes.local:8000');
  assert.throws(() => gatewayAddress('http://hermes.local:8000', false));
  assert.throws(() => gatewayAddress('http://public.example.com', true));
  assert.throws(() => gatewayAddress('http://192.168.1.2.example.com', true));
});
