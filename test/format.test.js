'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { relativeTime, absoluteTime, formatSize, truncate, plainify } = require('../src/lib/format');
const i18n = require('../src/i18n');

test('相对时间按分钟、小时、昨天和日期分段', () => {
  i18n.setLocale('en');
  const now = Date.parse('2026-09-24T12:00:00.000Z');
  const ago = (milliseconds) => new Date(now - milliseconds).toISOString();
  assert.strictEqual(relativeTime(ago(90 * 1000), now), '1 min ago');

  i18n.setLocale('zh-cn');
  assert.strictEqual(relativeTime(ago(59 * 1000), now), '刚刚');
  assert.strictEqual(relativeTime(ago(90 * 1000), now), '1 分钟前');
  assert.strictEqual(relativeTime(ago(25 * 60 * 60 * 1000), now), '昨天');
  assert.match(relativeTime(ago(40 * 24 * 60 * 60 * 1000), now), /^\d{1,2}-\d{1,2}$/);
  i18n.setLocale('en');
});

test('绝对时间使用本地时区，大小和截断格式正确', () => {
  const date = new Date('2026-09-14T12:07:00.000Z');
  const expected = `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  assert.strictEqual(absoluteTime('2026-09-14T12:07:00.000Z'), expected);
  assert.strictEqual(formatSize(900), '900 B');
  assert.strictEqual(formatSize(340 * 1024), '340 KB');
  assert.strictEqual(formatSize(1258291), '1.2 MB');
  assert.strictEqual(truncate('abcdef', 4), 'abc…');
  assert.strictEqual(truncate('短文本', 4), '短文本');
});

test('Markdown 洗成窄面板能读的纯文本', () => {
  const source = [
    '## 现在的状态',
    '',
    '| | 状态 |',
    '|---|---|',
    '| 个体户 | 跑着 |',
    '',
    '**重点**：看 [清单](https://example.com/a) 和 `npm run dev`。',
    '',
    '- 第一项',
    '- 第二项',
    '',
    '```bash',
    'git push',
    '```'
  ].join('\n');

  assert.strictEqual(plainify(source), [
    '现在的状态',
    '',
    '状态',
    '个体户 · 跑着',
    '',
    '重点：看 清单 和 npm run dev。',
    '',
    '• 第一项',
    '• 第二项',
    '',
    'git push'
  ].join('\n'));
});

test('Markdown 清洗不吞内容也不留下 HTML 危险字符', () => {
  // 表格首行没有表头分隔行时也要保留
  assert.strictEqual(plainify('| a | b |'), 'a · b');
  // 图片整段去掉、引用去符号
  assert.strictEqual(plainify('![图](x.png) > 引用'), '引用');
  assert.strictEqual(plainify('> 引用\n>> 更深'), '引用\n更深');
  // 分隔线消失，但普通破折号行不受影响
  assert.strictEqual(plainify('---\n-----\n好'), '好');
  assert.strictEqual(plainify('2026-09-25 上线'), '2026-09-25 上线');
  // 不产出 HTML：标签原样保留为文字，由 webview 的 textContent 负责不解析
  assert.strictEqual(plainify('<b>粗</b>'), '<b>粗</b>');
  assert.strictEqual(plainify(null), '');
  assert.strictEqual(plainify('  \n\n  '), '');
});
