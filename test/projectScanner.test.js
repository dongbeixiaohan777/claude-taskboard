'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { scanProjects } = require('../src/lib/projectScanner');

test('项目扫描解析状态、递归文件数和 README 摘要', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-projects-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'README.md'), '# 根目录说明，不是项目');

  const completedPath = path.join(root, '语音输入助手-已完成');
  await fs.mkdir(path.join(completedPath, 'docs'), { recursive: true });
  await fs.writeFile(path.join(completedPath, 'README.md'), '# 标题\n\n这是项目摘要。\n');
  await fs.writeFile(path.join(completedPath, 'docs', 'design.md'), '设计');

  const noStatusPath = path.join(root, '漫剧测试片');
  await fs.mkdir(noStatusPath);
  await fs.writeFile(path.join(noStatusPath, 'note.txt'), '记录');

  const projects = await scanProjects(root);
  assert.strictEqual(projects.length, 2);

  const completed = projects.find((project) => project.dirName === '语音输入助手-已完成');
  assert.strictEqual(completed.name, '语音输入助手');
  assert.strictEqual(completed.status, 'live');
  assert.strictEqual(completed.docCount, 2);
  assert.strictEqual(completed.summary, '这是项目摘要。');
  assert.ok(completed.mtimeMs > 0);
  assert.strictEqual(completed.readmePath, path.join(completedPath, 'README.md'));

  const unmarked = projects.find((project) => project.dirName === '漫剧测试片');
  assert.strictEqual(unmarked.name, '漫剧测试片');
  assert.strictEqual(unmarked.status, null);
  assert.strictEqual(unmarked.docCount, 1);
  assert.strictEqual(unmarked.readmePath, null);
  assert.strictEqual(unmarked.summary, null);
});

test('项目状态识别英文后缀并忽略大小写', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taskboard-project-status-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'MyApp-Planning'));
  await fs.mkdir(path.join(root, 'MyApp-DONE'));
  await fs.mkdir(path.join(root, 'MyApp-in-progress'));

  const projects = await scanProjects(root);
  assert.strictEqual(projects.find((project) => project.dirName === 'MyApp-Planning').status, 'plan');
  assert.strictEqual(projects.find((project) => project.dirName === 'MyApp-DONE').status, 'live');
  assert.strictEqual(projects.find((project) => project.dirName === 'MyApp-in-progress').status, 'dev');
});
