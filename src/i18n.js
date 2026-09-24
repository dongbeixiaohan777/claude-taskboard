'use strict';

let locale = 'en';

const STRINGS = {
  en: {
    'time.justNow': 'just now',
    'time.minutesAgo': '{0} min ago',
    'time.hoursAgo': '{0} h ago',
    'time.yesterday': 'yesterday',
    'time.daysAgo': '{0} d ago',
    'status.plan': 'Planning',
    'status.dev': 'In progress',
    'status.live': 'Shipped',
    'status.arch': 'Archived',
    'status.none': 'Unlabeled',
    'notice.sessionDirMissing': 'Claude session folder not found.',
    'notice.projectsDirMissing': 'Project folder not found.',
    'notice.noWorkspace': 'No folder is open.',
    'notice.readSessionsFailed': 'Some sessions could not be read.',
    'notice.scanSessionsFailed': 'Could not read the session folder.',
    'notice.scanProjectsFailed': 'Could not read the project folder.',
    'notice.cacheWriteFailed': 'Could not write the cache.',
    'notice.locateSessionFailed': 'Could not locate the session folder.',
    'toast.genericError': 'That did not work. Please try again.',
    'toast.claudeNotInstalled': 'Claude Code extension not found. Opening the extension page.',
    'toast.claudeOpenFailed': 'Claude Code could not open that session.',
    'toast.sessionNotFound': 'Session not found. Try refreshing.',
    'toast.previewFailed': 'Could not read the session preview.',
    'toast.noReadme': 'This project has no README.md to open.',
    'toast.revealFailed': 'Could not reveal that folder in the explorer.'
  },
  'zh-cn': {
    'time.justNow': '刚刚',
    'time.minutesAgo': '{0} 分钟前',
    'time.hoursAgo': '{0} 小时前',
    'time.yesterday': '昨天',
    'time.daysAgo': '{0} 天前',
    'status.plan': '规划中',
    'status.dev': '开发中',
    'status.live': '已完成',
    'status.arch': '已归档',
    'status.none': '未标注',
    'notice.sessionDirMissing': '会话目录不存在',
    'notice.projectsDirMissing': '项目目录不存在',
    'notice.noWorkspace': '未打开工作区',
    'notice.readSessionsFailed': '部分会话读取失败',
    'notice.scanSessionsFailed': '无法读取会话目录',
    'notice.scanProjectsFailed': '无法读取项目目录',
    'notice.cacheWriteFailed': '缓存写入失败',
    'notice.locateSessionFailed': '无法定位会话目录',
    'toast.genericError': '操作没有完成，请稍后重试。',
    'toast.claudeNotInstalled': '尚未安装 Claude Code 扩展，正在打开扩展页面。',
    'toast.claudeOpenFailed': 'Claude Code 暂时无法打开这个会话。',
    'toast.sessionNotFound': '找不到这个会话，请刷新后重试。',
    'toast.previewFailed': '暂时无法读取会话预览。',
    'toast.noReadme': '这个项目还没有可打开的 README.md。',
    'toast.revealFailed': '暂时无法在资源管理器中定位这个目录。'
  }
};

function setLocale(raw) {
  const value = String(raw || '').toLowerCase();
  locale = value.startsWith('zh') ? 'zh-cn' : 'en';
}

function getLocale() {
  return locale;
}

function t(key, ...args) {
  const value = STRINGS[locale][key] || STRINGS.en[key] || key;
  return value.replace(/\{(\d+)\}/g, (match, index) => (
    args[Number(index)] === undefined ? match : args[Number(index)]
  ));
}

module.exports = { setLocale, getLocale, t, STRINGS };
