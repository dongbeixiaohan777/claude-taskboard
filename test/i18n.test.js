'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const i18n = require('../src/i18n');

test('扩展侧中英文键集合相同且支持参数插值', () => {
  assert.deepStrictEqual(Object.keys(i18n.STRINGS.en).sort(), Object.keys(i18n.STRINGS['zh-cn']).sort());
  i18n.setLocale('en');
  assert.strictEqual(i18n.t('time.minutesAgo', 3), '3 min ago');
  i18n.setLocale('zh-tw');
  assert.strictEqual(i18n.getLocale(), 'zh-cn');
  assert.strictEqual(i18n.t('time.minutesAgo', 3), '3 分钟前');
  assert.strictEqual(i18n.t('missing.key'), 'missing.key');
  i18n.setLocale('en');
});

test('webview 侧中英文键集合相同且默认英文', () => {
  const window = {};
  const script = fs.readFileSync(path.join(__dirname, '..', 'media', 'i18n.js'), 'utf8');
  vm.runInNewContext(script, { window });
  assert.deepStrictEqual(window.I18N_KEYS.en.slice().sort(), window.I18N_KEYS['zh-cn'].slice().sort());
  assert.strictEqual(window.T('panel.title'), 'Taskboard');
  assert.strictEqual(window.T('unit.prompts', 4), '4 prompts');
  window.initI18n('zh-cn');
  assert.strictEqual(window.T('panel.title'), '任务面板');
  assert.strictEqual(window.T('unit.prompts', 4), '4 次提问');
});
