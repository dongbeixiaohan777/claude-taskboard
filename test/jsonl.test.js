'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { readUserContent, isRealPrompt } = require('../src/lib/jsonl');

test('从字符串或 text 块提取用户内容', () => {
  assert.strictEqual(readUserContent({ message: { content: '直接文本' } }), '直接文本');
  assert.strictEqual(readUserContent({
    message: {
      content: [
        { type: 'text', text: '第一段' },
        { type: 'image', source: '忽略' },
        { type: 'text', text: '第二段' },
        { type: 'tool_result', content: '忽略' }
      ]
    }
  }), '第一段\n第二段');
  assert.strictEqual(readUserContent({ message: { content: null } }), '');
});

test('真实提问会排除 meta、tool_result、空内容和全部噪音前缀', () => {
  const prefixes = [
    '<local-command-caveat>',
    '<command-name>',
    '<command-message>',
    '<command-args>',
    '<local-command-stdout>',
    '<\\system-reminder',
    '</system-reminder',
    '<bash-input>',
    '<bash-stdout>',
    '[Request interrupted',
    'Caveat:'
  ];

  for (const prefix of prefixes) {
    assert.strictEqual(isRealPrompt({
      type: 'user',
      message: { content: [{ type: 'text', text: `${prefix} noise` }] }
    }), false, prefix);
  }

  assert.strictEqual(isRealPrompt({
    type: 'user', isMeta: true, message: { content: '正常问题' }
  }), false);
  assert.strictEqual(isRealPrompt({
    type: 'user', message: { content: [{ type: 'tool_result' }, { type: 'text', text: '结果' }] }
  }), false);
  assert.strictEqual(isRealPrompt({ type: 'user', message: { content: '  ' } }), false);
  assert.strictEqual(isRealPrompt({ type: 'assistant', message: { content: '问题' } }), false);
  assert.strictEqual(isRealPrompt({ type: 'user', message: { content: '请解释这段代码' } }), true);
});
