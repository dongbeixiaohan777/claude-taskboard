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

module.exports = { relativeTime, absoluteTime, formatSize, truncate };
