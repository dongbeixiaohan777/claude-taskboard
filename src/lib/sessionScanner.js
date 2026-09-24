'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { isRealPrompt, readPromptText, readUserContent } = require('./jsonl');

async function scanSessionFile(filePath) {
  const absolutePath = path.resolve(filePath);
  let aiTitle = null;
  let customTitle = null;
  let realPromptCount = 0;
  let userCount = 0;
  let assistantCount = 0;
  let firstPrompt = null;
  let minTs = null;
  let maxTs = null;
  let gitBranch = null;
  const models = new Set();
  const promptTimestamps = [];

  const input = fs.createReadStream(absolutePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (!record || typeof record !== 'object') continue;

    if (typeof record.timestamp === 'string') {
      if (!minTs || record.timestamp < minTs) minTs = record.timestamp;
      if (!maxTs || record.timestamp > maxTs) maxTs = record.timestamp;
    }

    if (typeof record.gitBranch === 'string') gitBranch = record.gitBranch;

    if (record.type === 'ai-title' && typeof record.aiTitle === 'string') {
      aiTitle = record.aiTitle;
    } else if (record.type === 'custom-title' && typeof record.customTitle === 'string') {
      customTitle = record.customTitle;
    } else if (record.type === 'assistant') {
      assistantCount++;
      if (typeof record.message?.model === 'string') models.add(record.message.model);
    } else if (record.type === 'user') {
      userCount++;
      if (isRealPrompt(record)) {
        realPromptCount++;
        if (typeof record.timestamp === 'string') promptTimestamps.push(record.timestamp);
        if (firstPrompt === null) {
          firstPrompt = readPromptText(record).slice(0, 400);
        }
      }
    }
  }

  const stats = await fs.promises.stat(absolutePath);
  const titleSource = aiTitle ? 'ai' : customTitle ? 'custom' : firstPrompt ? 'prompt' : 'none';
  const title = aiTitle || customTitle || (firstPrompt
    ? firstPrompt.slice(0, 24) + (firstPrompt.length > 24 ? '…' : '')
    : '(空会话)');

  return {
    id: path.basename(absolutePath, '.jsonl'),
    file: absolutePath,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    title,
    titleSource,
    realPromptCount,
    userCount,
    assistantCount,
    firstPrompt,
    promptTimestamps,
    firstTs: minTs,
    lastTs: maxTs,
    models: [...models],
    gitBranch,
    isEmpty: realPromptCount === 0 && titleSource === 'none'
  };
}

async function scanProjectDir(dirPath, opts = {}) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.jsonl')
    .map((entry) => path.join(dirPath, entry.name));
  const requestedConcurrency = opts.concurrency ?? 4;
  const concurrency = Number.isInteger(requestedConcurrency) && requestedConcurrency > 0
    ? requestedConcurrency
    : 4;
  const results = new Array(files.length);
  const cachedSessions = opts.cachedSessions || {};
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const filePath = path.resolve(files[index]);
      try {
        const stats = await fs.promises.stat(filePath);
        const id = path.basename(filePath, '.jsonl');
        const cached = cachedSessions[id];
        if (!opts.force && cached && cached.file === filePath &&
            cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
          results[index] = cached;
        } else {
          results[index] = await scanSessionFile(filePath);
        }
      } catch (error) {
        opts.onError?.(filePath, error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
  );

  return results.filter(Boolean).sort((a, b) => {
    if (a.lastTs === null) return b.lastTs === null ? 0 : 1;
    if (b.lastTs === null) return -1;
    if (a.lastTs === b.lastTs) return 0;
    return a.lastTs > b.lastTs ? -1 : 1;
  });
}

async function readSessionPreview(filePath, opts = {}) {
  const requestedReplies = opts.maxReplies ?? 3;
  const maxReplies = Number.isInteger(requestedReplies) && requestedReplies > 0
    ? requestedReplies
    : 3;
  let firstPrompt = null;
  const lastReplies = [];
  const input = fs.createReadStream(path.resolve(filePath), { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!record || typeof record !== 'object') continue;

    if (firstPrompt === null && isRealPrompt(record)) {
      firstPrompt = readPromptText(record).slice(0, 400);
    } else if (record.type === 'assistant') {
      const text = readUserContent(record).trim();
      if (!text) continue;
      lastReplies.push(text.slice(0, 300));
      if (lastReplies.length > maxReplies) lastReplies.shift();
    }
  }

  return { firstPrompt, lastReplies };
}

module.exports = { scanSessionFile, scanProjectDir, readSessionPreview };
