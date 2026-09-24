'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SessionCache } = require('../src/cache');

test('session cache ignores invalid files and atomically stores only small metadata', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-cache-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const cache = new SessionCache(dir);

  assert.deepStrictEqual(await cache.read(), {});
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'session-index.json'), '{broken');
  assert.deepStrictEqual(await cache.read(), {});
  await fs.writeFile(path.join(dir, 'session-index.json'), JSON.stringify({ version: 2, sessions: {} }));
  assert.deepStrictEqual(await cache.read(), {});

  await cache.write([{
    id: 'session-1',
    file: path.join(dir, 'session-1.jsonl'),
    size: 10,
    mtimeMs: 20,
    title: 'Short title',
    firstPrompt: 'do not persist prompt text',
    models: ['a', 'b', 'c', 'd'],
    promptTimestamps: ['2026-09-21T12:00:00.000Z']
  }]);
  const stored = JSON.parse(await fs.readFile(path.join(dir, 'session-index.json'), 'utf8'));
  assert.strictEqual(stored.version, 1);
  assert.deepStrictEqual(stored.sessions['session-1'].models, ['a', 'b', 'c']);
  assert.strictEqual('firstPrompt' in stored.sessions['session-1'], false);
  assert.deepStrictEqual((await cache.read())['session-1'].promptTimestamps, ['2026-09-21T12:00:00.000Z']);
  assert.strictEqual(await fs.stat(path.join(dir, 'session-index.json.tmp')).then(() => true, () => false), false);
});
