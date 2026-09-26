'use strict';

const { t } = require('../i18n');

function relativeTime(isoString, now = Date.now()) {
  const timestamp = new Date(isoString).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const elapsed = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) return t('time.justNow');
  if (elapsed < hour) return t('time.minutesAgo', Math.floor(elapsed / minute));
  if (elapsed < day) return t('time.hoursAgo', Math.floor(elapsed / hour));
  if (elapsed < 2 * day) return t('time.yesterday');
  if (elapsed <= 30 * day) return t('time.daysAgo', Math.floor(elapsed / day));

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

function absoluteTime(isoString) {
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const formatted = Number(value.toFixed(1)).toString();
  return `${formatted} ${units[unitIndex]}`;
}

function truncate(value, max) {
  const text = String(value);
  if (text.length <= max) return text;
  if (max <= 0) return '';
  return `${text.slice(0, max - 1)}…`;
}

// 助手的回复是 Markdown，塞进 300px 宽的抽屉里全是噪音（##、**、表格竖线）。
// 这里只做「去符号、留文字」，不追求还原排版：抽屉用 textContent 渲染，
// 所以不能产出 HTML —— 也就不存在注入问题。
function plainify(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/^[ \t]*```[^\n]*$/gm, '');                      // 代码围栏（内容保留）
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');                    // 图片
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');                 // 链接留文字
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');                // 标题
  text = text.replace(/^[ \t]{0,3}(?:>[ \t]?)+/gm, '');                // 引用
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[\s(（])[*_]([^*_\n]+)[*_]/g, '$1$2');       // 斜体
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/^[ \t]*[-*_](?:[ \t]*[-*_]){2,}[ \t]*$/gm, '');  // 分隔线
  // 表格分隔行连同它的换行一起删掉，否则表头和数据之间会凭空多一个空行
  text = text.replace(/^[ \t]*\|[:| \t-]*-{2,}[:| \t-]*\|[ \t]*\n?/gm, '');
  text = text.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (line, row) => (
    row.split('|').map((cell) => cell.trim()).filter(Boolean).join(' · ')
  ));
  text = text.replace(/^([ \t]*)[-*+][ \t]+/gm, '$1• ');               // 列表
  text = text.replace(/[ \t]+$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

module.exports = { relativeTime, absoluteTime, formatSize, truncate, plainify };
