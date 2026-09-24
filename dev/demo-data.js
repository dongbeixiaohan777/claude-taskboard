// 演示数据 —— 专供 README / 市场截图，不随扩展发布。
//
// 为什么不用 preview-data.js：那份是作者真实数据的快照，项目名和会话标题里
// 含职业身份线索（行业、专业方向）。README 截图会公开在 GitHub 与市场上，
// 必须脱敏。这份是无关的虚构数据。
//
// ⚠️ ago 字段不能写死英文字面量 —— 中文视图下会露出英文。
// 真机上 ago 由扩展侧的 src/lib/format.js 算好再推送过来（那边走 src/i18n.js），
// webview 的 media/i18n.js 里【没有】time.* 键。所以沙盘要自带一份小时长表。
// makeDemo(locale) 在 initI18n() 之后再调。

var DEMO_TIME = {
  'en': {
    justNow: 'just now',
    minutesAgo: function (n) { return n + ' min ago'; },
    hoursAgo: function (n) { return n + ' h ago'; },
    yesterday: 'yesterday',
    daysAgo: function (n) { return n + ' d ago'; },
    weeksAgo: function (n) { return n + ' w ago'; }
  },
  'zh-cn': {
    justNow: '刚刚',
    minutesAgo: function (n) { return n + ' 分钟前'; },
    hoursAgo: function (n) { return n + ' 小时前'; },
    yesterday: '昨天',
    daysAgo: function (n) { return n + ' 天前'; },
    weeksAgo: function (n) { return n + ' 周前'; }
  }
};

/** @param {string} locale 'en' | 'zh-cn' */
function makeDemo(locale) {
  var L = DEMO_TIME[locale] || DEMO_TIME.en;
  var ago = function (key, n) {
    var v = L[key];
    return typeof v === 'function' ? v(n) : v;
  };

  return {
    view: 'board',
    glass: 'auto',
    claude: { installed: true },
    errors: [],
    stats: { projectCount: 5, sessionCount: 21, weekCount: 9 },

    // 有一周归零 —— 让「空周保留基线」这个设计在截图里也看得出来
    pulse: [2, 6, 0, 11, 27, 8, 19, 9],

    projects: [
      { name: 'docs-site',     status: 'dev',  docCount: 8, mtimeMs: 0, ago: ago('yesterday'),
        summary: 'Marketing site rebuilt on a static generator. Migrated all legacy pages.' },
      { name: 'api-gateway',   status: 'plan', docCount: 4, mtimeMs: 0, ago: ago('daysAgo', 3),
        summary: 'Rate limiting and auth for the public API. Nothing built yet.' },
      { name: 'cli-tool',      status: 'live', docCount: 6, mtimeMs: 0, ago: ago('weeksAgo', 2),
        summary: 'Command-line client, v1 shipped. Maintenance mode.' },
      { name: 'old-prototype', status: 'arch', docCount: 2, mtimeMs: 0, ago: ago('daysAgo', 5),
        summary: null },
      { name: 'scratch-notes', status: null,   docCount: 3, mtimeMs: 0, ago: ago('justNow'),
        summary: 'Loose notes that never became a project.' }
    ],

    sessions: [
      { id: 'd1',  title: 'Refactor the auth middleware',    promptCount: 9,  ago: ago('justNow'),    branch: 'main',    empty: false },
      { id: 'd2',  title: 'Fix flaky integration tests',     promptCount: 5,  ago: ago('hoursAgo', 2), branch: 'main',   empty: false },
      { id: 'd3',  title: 'Set up the CI pipeline',          promptCount: 12, ago: ago('yesterday'),  branch: 'main',    empty: false },
      { id: 'd4',  title: 'Investigate the memory leak',     promptCount: 7,  ago: ago('daysAgo', 2), branch: 'fix/mem', empty: false },
      { id: 'd5',  title: 'Write API reference docs',        promptCount: 4,  ago: ago('daysAgo', 3), branch: 'main',    empty: false },
      { id: 'd6',  title: 'Migrate the build to ESM',        promptCount: 18, ago: ago('daysAgo', 4), branch: 'main',    empty: false },
      { id: 'd7',  title: 'Debug WebSocket reconnect logic', promptCount: 6,  ago: ago('daysAgo', 5), branch: 'main',    empty: false },
      { id: 'd8',  title: 'Design the database schema',      promptCount: 11, ago: ago('weeksAgo', 1), branch: 'main',   empty: false },
      { id: 'd9',  title: 'Speed up the test suite',         promptCount: 3,  ago: ago('daysAgo', 9), branch: 'main',    empty: false },
      { id: 'd10', title: '',                                promptCount: 0,  ago: ago('weeksAgo', 2), branch: 'main',   empty: true }
    ]
  };
}
