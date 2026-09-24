'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const paths = require('../src/lib/paths');

async function makeWorkspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-paths-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('resolveProjectsDir 优先使用已配置的目录且不校验存在性', async () => {
  const result = await paths.resolveProjectsDir('D:\\Claude', 'E:\\其它\\项目');
  assert.strictEqual(result, 'E:\\其它\\项目');
});

test('空白配置按候选顺序回退到 KB/02-项目', async (t) => {
  const root = await makeWorkspace(t);
  const expected = path.join(root, 'KB', '02-项目');
  await fs.mkdir(expected, { recursive: true });
  await fs.mkdir(path.join(root, 'projects'));
  assert.strictEqual(await paths.resolveProjectsDir(root, '   '), expected);
});

test('空字符串配置会自动探测现有目录', async (t) => {
  const root = await makeWorkspace(t);
  const expected = path.join(root, 'KB', '02-项目');
  await fs.mkdir(expected, { recursive: true });
  assert.strictEqual(await paths.resolveProjectsDir(root, ''), expected);
});

test('既没有配置也没有工作区时返回 null', async () => {
  assert.strictEqual(await paths.resolveProjectsDir(null, ''), null);
  assert.strictEqual(await paths.resolveProjectsDir(undefined, undefined), null);
});

test('配置值不是字符串时按未配置处理并探测目录', async (t) => {
  const root = await makeWorkspace(t);
  const expected = path.join(root, 'projects');
  await fs.mkdir(expected);
  assert.strictEqual(await paths.resolveProjectsDir(root, 42), expected);
});

test('配置值两侧空白会被裁掉', async () => {
  const result = await paths.resolveProjectsDir('D:\\Claude', '  D:\\KB\\02-项目  ');
  assert.strictEqual(result, 'D:\\KB\\02-项目');
});

test('没有 KB/02-项目但有 projects 目录时返回 projects', async (t) => {
  const root = await makeWorkspace(t);
  const expected = path.join(root, 'projects');
  await fs.mkdir(expected);
  assert.strictEqual(await paths.resolveProjectsDir(root, ''), expected);
});

test('跳过同名文件并继续查找目录候选', async (t) => {
  const root = await makeWorkspace(t);
  await fs.writeFile(path.join(root, 'projects'), 'not a directory');
  const expected = path.join(root, 'docs', 'projects');
  await fs.mkdir(expected, { recursive: true });
  assert.strictEqual(await paths.resolveProjectsDir(root, ''), expected);
});

test('候选目录都不存在时返回 null', async (t) => {
  const root = await makeWorkspace(t);
  assert.strictEqual(await paths.resolveProjectsDir(root, ''), null);
});

test('encodeWorkspaceKey 与实测规则一致', () => {
  assert.strictEqual(paths.encodeWorkspaceKey('d:\\Claude'), 'd--Claude');
});

test('normalizePath 统一斜杠方向、大小写与尾斜杠', () => {
  assert.strictEqual(paths.normalizePath('D:\\Claude\\'), 'd:/claude');
  assert.strictEqual(paths.normalizePath('d:/Claude'), 'd:/claude');
});
