'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const paths = require('../src/lib/paths');

test('resolveProjectsDir 优先使用已配置的目录', () => {
  const result = paths.resolveProjectsDir('D:\\Claude', 'E:\\其它\\项目');
  assert.strictEqual(result, 'E:\\其它\\项目');
});

test('resolveProjectsDir 忽略纯空白配置，回退到工作区下的 KB/02-项目', () => {
  const result = paths.resolveProjectsDir('D:\\Claude', '   ');
  assert.strictEqual(result, path.join('D:\\Claude', 'KB', '02-项目'));
});

// 这是真机上抓到的 bug 的回归测试：
// package.json 把 taskboard.projectsDir 的默认值注册成了空字符串 ""，
// 而 VS Code 的 getConfiguration().get(section, fallback) 只在设置【未定义】
// 时才用 fallback —— 已被注册的项永远返回 ""，fallback 是死代码。
// 旧实现直接 await fs.access("") → ENOENT → 项目区一个都不显示。
test('空字符串配置不得直接透传（会导致 fs.access ENOENT）', () => {
  const result = paths.resolveProjectsDir('D:\\Claude', '');
  assert.strictEqual(result, path.join('D:\\Claude', 'KB', '02-项目'));
});

test('既没有配置也没有工作区时返回 null，而不是空字符串', () => {
  assert.strictEqual(paths.resolveProjectsDir(null, ''), null);
  assert.strictEqual(paths.resolveProjectsDir(undefined, undefined), null);
});

test('配置值不是字符串时按未配置处理', () => {
  const result = paths.resolveProjectsDir('D:\\Claude', 42);
  assert.strictEqual(result, path.join('D:\\Claude', 'KB', '02-项目'));
});

test('配置值两侧空白会被裁掉', () => {
  assert.strictEqual(paths.resolveProjectsDir('D:\\Claude', '  D:\\KB\\02-项目  '), 'D:\\KB\\02-项目');
});

test('encodeWorkspaceKey 与实测规则一致', () => {
  assert.strictEqual(paths.encodeWorkspaceKey('d:\\Claude'), 'd--Claude');
});

test('normalizePath 统一斜杠方向、大小写与尾斜杠', () => {
  assert.strictEqual(paths.normalizePath('D:\\Claude\\'), 'd:/claude');
  assert.strictEqual(paths.normalizePath('d:/Claude'), 'd:/claude');
});
