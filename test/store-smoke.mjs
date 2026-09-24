import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bucketPromptTimestamps } = require('../src/store.js');

const pulse = bucketPromptTimestamps([
  { promptTimestamps: ['2026-08-03T12:00:00.000Z'] },
  { promptTimestamps: ['2026-08-10T12:00:00.000Z'] },
  { promptTimestamps: [
    '2026-08-24T12:00:00.000Z',
    '2026-08-24T13:00:00.000Z'
  ] },
  { promptTimestamps: ['2026-08-31T12:00:00.000Z'] },
  { promptTimestamps: ['2026-09-07T12:00:00.000Z'] },
  { promptTimestamps: [
    '2026-09-21T12:00:00.000Z',
    '2026-09-21T13:00:00.000Z',
    'not-a-timestamp'
  ] }
], new Date('2026-09-23T12:00:00.000Z'));

assert.deepEqual(pulse, [1, 1, 0, 2, 1, 1, 0, 2]);
console.log('store smoke: 周分桶与空周保留正常');
