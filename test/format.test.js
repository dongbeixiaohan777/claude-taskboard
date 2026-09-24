'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { relativeTime, absoluteTime, formatSize, truncate } = require('../src/lib/format');
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
