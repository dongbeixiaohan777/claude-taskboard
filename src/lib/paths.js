'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const PROJECT_DIR_CANDIDATES = [
  ['KB', '02-项目'],
  ['projects'],
  ['docs', 'projects'],
  ['taskboard'],
  ['.taskboard', 'projects']
];

function claudeProjectsRoot() {
  return path.join(os.homedir(), '.claude', 'projects');
}

function encodeWorkspaceKey(fsPath) {
  return fsPath.replace(/[\\/:.]/g, '-');
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}

async function firstCwd(filePath) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineCount = 0;

  for await (const line of lines) {
    lineCount++;
    try {
      const record = JSON.parse(line);
      if (record && typeof record.cwd === 'string') return record.cwd;
    } catch {
      // 坏行略过，继续查找 cwd。
    }
    if (lineCount >= 200) break;
  }

  return null;
}

async function jsonlFiles(dirPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.jsonl')
    .map((entry) => path.join(dirPath, entry.name));
}

async function directoryMatches(dirPath, normalizedWorkspace) {
  for (const file of await jsonlFiles(dirPath)) {
    const cwd = await firstCwd(file);
    if (cwd && normalizePath(cwd) === normalizedWorkspace) return true;
  }
  return false;
}

async function findSessionDirFor(workspacePath, rootDir) {
  const absoluteRoot = path.resolve(rootDir);
  const expected = normalizePath(workspacePath);
  const guessedDir = path.join(absoluteRoot, encodeWorkspaceKey(workspacePath));

  if (await directoryMatches(guessedDir, expected)) return guessedDir;

  let entries;
  try {
    entries = await fs.promises.readdir(absoluteRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(absoluteRoot, entry.name);
    if (candidate === guessedDir) continue;
    const files = await jsonlFiles(candidate);
    if (files.length === 0) continue;
    const cwd = await firstCwd(files[0]);
    if (cwd && normalizePath(cwd) === expected) return candidate;
  }

  return null;
}

/**
 * 解析项目文档目录。
 * 配置项非空时直接使用；否则按常见目录候选顺序探测。
 *
 * @param {string | undefined} workspaceRoot
 * @param {unknown} configured 配置项原值
 * @returns {Promise<string | null>} 目录绝对路径；无法确定时返回 null
 */
async function resolveProjectsDir(workspaceRoot, configured) {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (value) return value;
  if (!workspaceRoot) return null;

  for (const parts of PROJECT_DIR_CANDIDATES) {
    const candidate = path.join(workspaceRoot, ...parts);
    try {
      await fs.promises.access(candidate);
      if ((await fs.promises.stat(candidate)).isDirectory()) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
  }
  return null;
}

module.exports = {
  claudeProjectsRoot,
  encodeWorkspaceKey,
  findSessionDirFor,
  normalizePath,
  resolveProjectsDir
};
