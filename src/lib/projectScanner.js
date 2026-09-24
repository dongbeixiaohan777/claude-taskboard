'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATUS_ALIASES = {
  '规划中': 'plan', planning: 'plan', plan: 'plan',
  '开发中': 'dev', active: 'dev', 'in-progress': 'dev', wip: 'dev', inprogress: 'dev',
  '已上线': 'live', '已完成': 'live', done: 'live', shipped: 'live', complete: 'live', completed: 'live',
  '已归档': 'arch', archived: 'arch', archive: 'arch'
};
const STATUS_SUFFIXES = Object.keys(STATUS_ALIASES).sort((a, b) => b.length - a.length);

function parseProjectName(dirName) {
  const lowerName = dirName.toLowerCase();
  for (const suffix of STATUS_SUFFIXES) {
    const marker = `-${suffix.toLowerCase()}`;
    if (lowerName.endsWith(marker)) {
      return { name: dirName.slice(0, -marker.length), status: STATUS_ALIASES[suffix] };
    }
  }
  return { name: dirName, status: null };
}

async function collectFiles(dirPath) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  let docCount = 0;
  let mtimeMs = null;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath);
      docCount += nested.docCount;
      if (nested.mtimeMs !== null && (mtimeMs === null || nested.mtimeMs > mtimeMs)) {
        mtimeMs = nested.mtimeMs;
      }
    } else if (entry.isFile()) {
      const stats = await fs.promises.stat(fullPath);
      docCount++;
      if (mtimeMs === null || stats.mtimeMs > mtimeMs) mtimeMs = stats.mtimeMs;
    }
  }

  return { docCount, mtimeMs };
}

async function readSummary(readmePath) {
  if (!readmePath) return null;

  const handle = await fs.promises.open(readmePath, 'r');
  try {
    const buffer = Buffer.alloc(800);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/);
    const line = lines.map((value) => value.trim()).find((value) => value && !value.startsWith('#'));
    return line ? line.slice(0, 80) : null;
  } finally {
    await handle.close();
  }
}

async function scanProjects(dirPath) {
  const absoluteDir = path.resolve(dirPath);
  const entries = await fs.promises.readdir(absoluteDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(absoluteDir, entry.name);
    const readmeCandidate = path.join(projectPath, 'README.md');
    let readmePath = null;
    try {
      if ((await fs.promises.stat(readmeCandidate)).isFile()) readmePath = readmeCandidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const [fileInfo, summary, parsed] = await Promise.all([
      collectFiles(projectPath),
      readSummary(readmePath),
      Promise.resolve(parseProjectName(entry.name))
    ]);

    projects.push({
      ...parsed,
      dirName: entry.name,
      path: projectPath,
      readmePath,
      docCount: fileInfo.docCount,
      mtimeMs: fileInfo.mtimeMs,
      summary
    });
  }

  return projects;
}

module.exports = { scanProjects };
