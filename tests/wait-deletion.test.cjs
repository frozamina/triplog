const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design.json'), 'utf8'));
const app = { innerHTML: '', querySelector: () => null };
const toast = { textContent: '', style: {} };
const document = {
  getElementById: id => ({ app, toast })[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};
const context = vm.createContext({
  Core: require(path.join(root, 'app/src/main/assets/core.js')),
  document,
  window: {},
  localStorage: { getItem: () => JSON.stringify(fixture), setItem: () => {} },
  confirm: () => true,
  alert: message => { throw Error(message); },
  setTimeout,
  clearTimeout,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  homeView: () => '', detailView: () => '', liveView: () => '', editorView: () => '',
  insightsView: () => '', compareView: () => '', mineView: () => '',
});
vm.runInContext(fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8'), context);

const result = vm.runInContext(`
  current = 'design-detail';
  edit();
  const before = Core.metrics(draft);
  actions.deleteSegment('wait1');
  const removedFromDraft = !draft.transfers.some(s => s.id === 'wait1');
  actions.saveDone();
  const saved = currentTrip();
  ({
    beforeWait: before.wait,
    removedFromDraft,
    savedWaits: saved.transfers.map(s => s.id),
    savedTimeline: Core.timeline(saved).map(s => s.id),
    afterWait: Core.metrics(saved).wait,
    afterGap: Core.metrics(saved).gap,
  });
`, context);

assert.equal(result.removedFromDraft, true);
assert.equal(result.beforeWait > result.afterWait, true);
assert.equal(result.savedWaits.includes('wait1'), false);
assert.equal(result.savedWaits.length, fixture.trips[0].transfers.length - 1);
assert.equal(result.savedTimeline[0], 'taxi');
assert.equal(result.savedTimeline[1], 'rail');
assert.equal(result.afterGap >= 42, true, 'Unrecorded time stays a gap, not a new wait');
console.log('PASS: deleting a transfer persists after saving without regenerating a wait.');
