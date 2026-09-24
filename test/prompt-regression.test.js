'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { scanSessionFile } = require('../src/lib/sessionScanner');
const { readUserContent } = require('../src/lib/jsonl');

const fixture = (name) => path.join(__dirname, 'fixtures', name);

test('text blocks are separated by newlines', () => {
  assert.strictEqual(readUserContent({
    message: {
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' }
      ]
    }
  }), 'first\nsecond');
});

test('task notifications are excluded while real prompts remain counted', async () => {
  const session = await scanSessionFile(fixture('task-notification.jsonl'));
  assert.strictEqual(session.realPromptCount, 1);
  assert.strictEqual(session.isEmpty, false);
});

test('tag-prefixed prompt text is retained and used as the first prompt', async () => {
  const session = await scanSessionFile(fixture('tag-prefixed.jsonl'));
  assert.strictEqual(session.realPromptCount, 1);
  assert.strictEqual(session.firstPrompt, '开工');
});

test('tag-only content is not counted as a prompt', async () => {
  const session = await scanSessionFile(fixture('tag-empty.jsonl'));
  assert.strictEqual(session.realPromptCount, 0);
});

test('slash command invocation is excluded while the real prompt is counted', async () => {
  const session = await scanSessionFile(fixture('slash-command.jsonl'));
  assert.strictEqual(session.realPromptCount, 1);
});
