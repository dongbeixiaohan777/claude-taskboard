'use strict';

const EXCLUDE_PREFIXES = [
  '<task-notification>',
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
  'Caveat:',
  '[Image:'
];

function stripLeadingTagBlocks(text) {
  let s = text;
  for (let i = 0; i < 5; i++) {
    const m = s.match(/^<([a-zA-Z_][\w-]*)>[\s\S]*?<\/\1>\s*/);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  return s.trim();
}

function readUserContent(record) {
  const content = record?.message?.content;

  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function readPromptText(record) {
  return stripLeadingTagBlocks(readUserContent(record).trim());
}

function isRealPrompt(record) {
  if (record?.type !== 'user') return false;
  if (record.isMeta === true) return false;

  const content = record.message?.content;
  if (Array.isArray(content) && content.some((block) => block?.type === 'tool_result')) {
    return false;
  }

  const raw = readUserContent(record).trim();
  if (!raw) return false;
  if (EXCLUDE_PREFIXES.some((prefix) => raw.startsWith(prefix))) return false;
  return stripLeadingTagBlocks(raw) !== '';
}

module.exports = { readUserContent, readPromptText, isRealPrompt };
