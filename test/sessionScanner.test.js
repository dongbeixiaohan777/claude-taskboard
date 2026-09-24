'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { scanSessionFile, scanProjectDir, readSessionPreview } = require('../src/lib/sessionScanner');

const fixture = (name) => path.join(__dirname, 'fixtures', name);

test('会话扫描取最后标题、统计真实提问并汇总时间戳', async () => {
  const session = await scanSessionFile(fixture('normal.jsonl'));
  assert.strictEqual(session.title, '最终会话标题');
  assert.strictEqual(session.titleSource, 'ai');
  assert.strictEqual(session.realPromptCount, 1);
  assert.strictEqual(session.userCount, 2);
  assert.strictEqual(session.assistantCount, 1);
  assert.strictEqual(session.firstPrompt, '请帮我梳理这个项目的启动步骤');
  assert.deepStrictEqual(session.models, ['claude-sonnet-4-5']);
  assert.strictEqual(session.gitBranch, 'feature/session-scan');
  assert.strictEqual(session.firstTs, '2026-09-20T08:00:00.000Z');
  assert.strictEqual(session.lastTs, '2026-09-24T10:00:00.000Z');
  assert.deepStrictEqual(session.promptTimestamps, ['2026-09-20T08:00:00.000Z']);
});

test('session preview returns first prompt and last three assistant replies', async (t) => {
  const filePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-preview-')), 'preview.jsonl');
  t.after(() => fs.rm(path.dirname(filePath), { recursive: true, force: true }));
  const rows = [
    { type: 'user', timestamp: '2026-09-01T00:00:00.000Z', message: { content: 'first question' } },
    { type: 'assistant', message: { content: 'reply one' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'reply two' }] } },
    { type: 'assistant', message: { content: 'reply three' } },
    { type: 'assistant', message: { content: 'reply four' } }
  ];
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n'));

  const preview = await readSessionPreview(filePath, { maxReplies: 3 });
  assert.strictEqual(preview.firstPrompt, 'first question');
  assert.deepStrictEqual(preview.lastReplies, ['reply two', 'reply three', 'reply four']);
});

test('标题依次支持自定义标题、首条提问和空会话回退', async () => {
  const custom = await scanSessionFile(fixture('custom-title.jsonl'));
  assert.strictEqual(custom.title, '手动设置的标题');
  assert.strictEqual(custom.titleSource, 'custom');

  const prompt = await scanSessionFile(fixture('prompt-fallback.jsonl'));
  assert.strictEqual(prompt.title, '请分析这个没有标题的会话并给出实现建议，并详细说…');
  assert.strictEqual(prompt.titleSource, 'prompt');

  const empty = await scanSessionFile(fixture('empty.jsonl'));
  assert.strictEqual(empty.title, '(空会话)');
  assert.strictEqual(empty.titleSource, 'none');
  assert.strictEqual(empty.isEmpty, true);
});

test('噪音和字符串 content 的处理符合预期', async () => {
  const noise = await scanSessionFile(fixture('noise.jsonl'));
  assert.strictEqual(noise.realPromptCount, 0);
  assert.strictEqual(noise.isEmpty, true);

  const stringContent = await scanSessionFile(fixture('string-content.jsonl'));
  assert.strictEqual(stringContent.realPromptCount, 1);
  assert.strictEqual(stringContent.firstPrompt, '帮我总结这段字符串内容');
});

test('乱序 timestamp 仍按最小值和最大值返回', async () => {
  const session = await scanSessionFile(fixture('out-of-order.jsonl'));
  assert.strictEqual(session.firstTs, '2026-09-12T20:00:00.000Z');
  assert.strictEqual(session.lastTs, '2026-09-24T20:00:00.000Z');
  assert.ok(session.firstTs < session.lastTs);
});

test('目录扫描只读 jsonl 文件并按 lastTs 降序排列', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-sessions-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.copyFile(fixture('empty.jsonl'), path.join(dir, 'older.jsonl'));
  await fs.copyFile(fixture('normal.jsonl'), path.join(dir, 'newer.jsonl'));
  await fs.mkdir(path.join(dir, 'ignored.jsonl'));

  const sessions = await scanProjectDir(dir, { concurrency: 1 });
  assert.deepStrictEqual(sessions.map((session) => session.id), ['newer', 'older']);
});
