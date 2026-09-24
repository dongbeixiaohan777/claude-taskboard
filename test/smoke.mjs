import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanProjectDir } = require('../src/lib/sessionScanner.js');
const { readUserContent } = require('../src/lib/jsonl.js');
const projectDir = path.join(os.homedir(), '.claude', 'projects', 'd--Claude');

function isSlashCommand(record) {
  const text = readUserContent(record).trim();
  const commandName = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1].trim();
  const command = commandName || text;
  return /^\/[A-Za-z0-9][\w-]*(?:\s+.*)?$/.test(command);
}

async function countHumanRecords(filePath) {
  let humanCount = 0;
  let slashCommandCount = 0;
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (record?.origin?.kind === 'human') {
      humanCount++;
      if (isSlashCommand(record)) slashCommandCount++;
    }
  }

  return { humanCount, slashCommandCount };
}

function safeTitle(value) {
  return String(value || '(untitled)')
    .replace(/\b(Bearer\s+)\S+/gi, '$1<REDACTED>')
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential|signature|sig)\s*[:=]\s*[^\s,;]+/gi, '$1=<REDACTED>')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '<REDACTED>')
    .replace(/[\r\n|]+/g, ' ')
    .slice(0, 48);
}

const sessions = await scanProjectDir(projectDir);
let totalPromptCount = 0;
let totalHumanCount = 0;
let totalSlashCommandCount = 0;

console.log('id       | prompts | title                                            | first - last');
console.log('---------|---------|--------------------------------------------------|-------------------------------');

for (const session of sessions) {
  const { humanCount, slashCommandCount } = await countHumanRecords(session.file);
  totalPromptCount += session.realPromptCount;
  totalHumanCount += humanCount;
  totalSlashCommandCount += slashCommandCount;
  const first = session.firstTs?.replace('T', ' ').slice(0, 19) || '-';
  const last = session.lastTs?.replace('T', ' ').slice(0, 19) || '-';
  console.log(`${session.id.slice(0, 8).padEnd(8)} | ${String(session.realPromptCount).padStart(7)} | ${safeTitle(session.title).padEnd(48)} | ${first} - ${last}`);
}

const humanPromptDifference = totalHumanCount - totalPromptCount;
const arithmeticRemainder = humanPromptDifference - totalSlashCommandCount;
console.log(`Total: ${totalPromptCount} prompts across ${sessions.length} sessions`);
console.log(`Human records: ${totalHumanCount}; slash commands: ${totalSlashCommandCount}`);
console.log(`Human minus prompts: ${humanPromptDifference}; after slash commands: ${arithmeticRemainder}`);

if (humanPromptDifference < 0 || humanPromptDifference > 2 || arithmeticRemainder !== 0) {
  console.error('Arithmetic self-check failed.');
  process.exitCode = 1;
}
