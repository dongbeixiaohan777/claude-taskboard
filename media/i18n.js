(function () {
  'use strict';

  var STRINGS = {
    en: {
      'panel.title': 'Taskboard',
      'stat.projects': 'Projects',
      'stat.sessions': 'Sessions',
      'stat.week': 'This week',
      'section.projects': 'Projects',
      'section.sessions': 'Sessions',
      'unit.docs': '{0} docs',
      'unit.docsShort': '{0} docs',
      'unit.prompts': '{0} prompts',
      'view.board': 'Board',
      'view.list': 'List',
      'status.plan': 'Planning',
      'status.dev': 'In progress',
      'status.live': 'Shipped',
      'status.arch': 'Archived',
      'status.none': 'Unlabeled',
      'empty.projects.title': 'No projects',
      'empty.projects.desc': 'Set taskboard.projectsDir, or add project folders to your workspace.',
      'empty.sessions.title': 'No sessions',
      'empty.sessions.desc': 'Start a conversation in Claude Code and it will show up here.',
      'session.untitled': '(empty session)',
      'pulse.aria': 'Prompts in the last 8 weeks',
      'pulse.axis.older': '8 weeks ago',
      'pulse.axis.label': 'prompts / week',
      'pulse.axis.now': 'This week',
      'pulse.tip': '{0} prompts',
      'pulse.weekAria': 'Week {0}: {1} prompts',
      'action.docs': 'Open project docs',
      'action.openInClaude': 'Open in Claude',
      'action.preview': 'Preview',
      'action.close': 'Close',
      'drawer.aria': 'Session preview',
      'notice.noClaude': 'Claude Code extension not found — preview works, but sessions cannot be reopened.',
      'drawer.noPrompt': 'No user prompt to show.',
      'drawer.noReplies': 'No assistant replies to show.',
      'notice.dismiss': 'Dismiss',
      'view.toggle': 'Switch view'
    },
    'zh-cn': {
      'panel.title': '任务面板',
      'stat.projects': '项目',
      'stat.sessions': '会话',
      'stat.week': '本周',
      'section.projects': '项目',
      'section.sessions': '会话',
      'unit.docs': '{0} 份文档',
      'unit.docsShort': '{0} 份',
      'unit.prompts': '{0} 次提问',
      'view.board': '看板',
      'view.list': '列表',
      'status.plan': '规划中',
      'status.dev': '开发中',
      'status.live': '已完成',
      'status.arch': '已归档',
      'status.none': '未标注',
      'empty.projects.title': '暂无项目',
      'empty.projects.desc': '检查项目目录设置，或在项目目录中添加项目文件夹。',
      'empty.sessions.title': '暂无会话',
      'empty.sessions.desc': '打开 Claude Code 并开始对话后，会话会出现在这里。',
      'session.untitled': '(空会话)',
      'pulse.aria': '最近八周提问数',
      'pulse.axis.older': '8 周前',
      'pulse.axis.label': '每周提问数',
      'pulse.axis.now': '本周',
      'pulse.tip': '{0} 次提问',
      'pulse.weekAria': '第 {0} 周：{1} 次提问',
      'action.docs': '打开项目文档',
      'action.openInClaude': '在 Claude 中打开',
      'action.preview': '预览',
      'action.close': '关闭',
      'drawer.aria': '会话预览',
      'notice.noClaude': '未检测到 Claude Code 扩展，只能预览、无法恢复会话。',
      'drawer.noPrompt': '没有可显示的真实提问。',
      'drawer.noReplies': '没有可显示的助手回复。',
      'notice.dismiss': '关闭提示',
      'view.toggle': '切换视图'
    }
  };

  var locale = 'en';

  window.initI18n = function (raw) {
    locale = String(raw || '').toLowerCase().indexOf('zh') === 0 ? 'zh-cn' : 'en';
  };
  window.T = function (key) {
    var args = Array.prototype.slice.call(arguments, 1);
    var strings = STRINGS[locale] || STRINGS.en;
    var value = strings[key] || STRINGS.en[key] || key;
    return value.replace(/\{(\d+)\}/g, function (match, index) {
      return args[+index] !== undefined ? args[+index] : match;
    });
  };
  window.I18N_KEYS = {
    en: Object.keys(STRINGS.en),
    'zh-cn': Object.keys(STRINGS['zh-cn'])
  };
})();
