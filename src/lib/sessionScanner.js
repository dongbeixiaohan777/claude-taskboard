'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { isRealPrompt, readPromptText, readUserContent } = require('./jsonl');

function positive(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

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

// 预览回答「这个会话聊到哪了」，所以只取三样：开头那次提问、最后一次提问、
// 最后一条助手文字（也就是这一轮的结论）。中间的碎话不要 —— 窄抽屉里读不完。
async function readSessionPreview(filePath, opts = {}) {
  const promptChars = positive(opts.maxPromptChars, 400);
  // 这里的上限只是内存护栏，不是显示长度：真正决定「给用户看多少」的是
  // store.readPreview 里 plainify 之后再截的那一刀。两个上限顺序不能颠倒 ——
  // 先按原文字数截，会把「开头全是图片/表格线、正文在后面」的回复整条截没。
  const replyChars = positive(opts.maxReplyChars, 20000);
  let firstPrompt = null;
  let lastPrompt = null;
  let lastReply = null;
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

    if (isRealPrompt(record)) {
      const text = readPromptText(record);
      if (!text) continue;
      if (firstPrompt === null) firstPrompt = text.slice(0, promptChars);
      lastPrompt = text.slice(0, promptChars);
    } else if (record.type === 'assistant') {
      const text = readUserContent(record).trim();
      if (text) lastReply = text.slice(0, replyChars);
    }
  }

  return { firstPrompt, lastPrompt, lastReply };
}

module.exports = { scanSessionFile, scanProjectDir, readSessionPreview };
