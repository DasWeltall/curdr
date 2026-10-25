import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityMood } from '../src/data/mood';
import { seed } from '../src/data/seed';
test('a new workspace contains no fabricated work or messages', () => {
  const state = seed();
  assert.equal(state.settings.agent.name, 'curdr');
  for (const key of ['tasks', 'messages', 'files', 'approvals', 'skills', 'logs'] as const) assert.deepEqual(state[key], []);
  assert.equal(activityMood(state, '', null), 'idle');
});
test('face follows real activity, results and errors in a stable priority order', () => {
  const state = seed();
  assert.equal(activityMood({ ...state, iconState: 'think' }, '', null), 'think');
  assert.equal(activityMood({ ...state, iconState: 'work' }, '', null), 'work');
  assert.equal(activityMood({ ...state, iconState: 'need' }, '', null), 'need');
  assert.equal(activityMood(state, '', 'listen'), 'listen');
  assert.equal(activityMood(state, '', null, true), 'success');
  assert.equal(activityMood({ ...state, iconState: 'work' }, 'Connection failed', null), 'error');
});
