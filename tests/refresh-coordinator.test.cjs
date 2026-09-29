const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', output)(module.exports, module);
  return module.exports;
}
const { createRefreshCoordinator } = load('lib/refresh-coordinator.ts');
const { withBrowserWriteLock } = load('lib/browser-write-lock.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('focus and polling share one request; a failed refresh retains the last successful snapshot', async () => {
  let pending = deferred();
  let calls = 0;
  let snapshot;
  let error;
  const coordinator = createRefreshCoordinator({
    load: () => { calls++; return pending.promise; },
    onData: value => { snapshot = value; error = undefined; },
    onError: reason => { error = reason; },
  });
  const first = coordinator.refresh();
  assert.equal(coordinator.refresh(), first);
  await tick();
  assert.equal(calls, 1);
  pending.resolve({ price: 43000 });
  await first;
  pending = deferred();
  const refresh = coordinator.refresh();
  const failure = new Error('upstream unavailable');
  pending.reject(failure);
  await refresh;
  assert.deepEqual(snapshot, { price: 43000 });
  assert.equal(error, failure);
  pending = deferred();
  const retry = coordinator.refresh();
  pending.resolve({ price: 44000 });
  await retry;
  assert.equal(snapshot.price, 44000);
  assert.equal(error, undefined);
  assert.equal(calls, 3);
});

test('an old response cannot undo a saved edit, even if its transport ignores abort', async () => {
  const pending = deferred();
  let signal, snapshot = { price: 40000 };
  const coordinator = createRefreshCoordinator({
    load: abort => { signal = abort; return pending.promise; },
    onData: value => { snapshot = value; },
    onError: () => assert.fail('invalidated reads should be silent'),
  });
  const read = coordinator.refresh();
  await tick();
  await coordinator.mutate(async () => { snapshot = { price: 50000 }; });
  assert.equal(signal.aborted, true);
  pending.resolve({ price: 40000 });
  await read;
  assert.equal(snapshot.price, 50000);
});

test('refreshes arriving during writes run once after every pending write settles', async () => {
  const writeA = deferred(), writeB = deferred();
  let calls = 0;
  const coordinator = createRefreshCoordinator({ load: async () => ++calls, onData() {}, onError() {} });
  const first = coordinator.mutate(() => writeA.promise);
  const second = coordinator.mutate(() => writeB.promise);
  await coordinator.refresh(); await coordinator.refresh();
  assert.equal(calls, 0);
  writeA.resolve(); await first; await tick();
  assert.equal(calls, 0);
  writeB.resolve(); await second; await tick();
  assert.equal(calls, 1);
});

test('a failed mutation releases the queue and unmount invalidates in-flight responses', async () => {
  const pending = deferred();
  const results = [];
  const coordinator = createRefreshCoordinator({ load: () => pending.promise, onData: value => results.push(value), onError: error => results.push(error) });
  await assert.rejects(coordinator.mutate(async () => { throw new Error('conflict'); }), /conflict/);
  const flight = coordinator.refresh();
  coordinator.dispose();
  pending.resolve('old page');
  await flight;
  assert.deepEqual(results, []);
  // React Strict Mode can mount the same effect again after cleanup.
  await coordinator.refresh();
  assert.deepEqual(results, ['old page']);
});

test('local writes use the same exclusive browser lock and fail closed without Web Locks', async () => {
  const original = Object.getOwnPropertyDescriptor(global, 'navigator');
  const entered = [];
  let queue = Promise.resolve();
  try {
    Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: {
      request(name, options, operation) {
        assert.equal(name, 'motors-local-data'); assert.equal(options.mode, 'exclusive');
        const next = queue.then(operation); queue = next.catch(() => {}); return next;
      },
    } } });
    const pause = deferred();
    const first = withBrowserWriteLock(async () => { entered.push('A'); await pause.promise; entered.push('A done'); });
    const second = withBrowserWriteLock(() => { entered.push('B'); });
    await tick(); assert.deepEqual(entered, ['A']);
    pause.resolve(); await Promise.all([first, second]);
    assert.deepEqual(entered, ['A', 'A done', 'B']);
    Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
    await assert.rejects(withBrowserWriteLock(() => assert.fail('must not write without a cross-tab lock')), /браузер/);
  } finally {
    if (original) Object.defineProperty(global, 'navigator', original); else delete global.navigator;
  }
});
