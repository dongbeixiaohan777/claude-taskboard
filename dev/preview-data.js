// 沙盘数据 —— 取自用户真实数据的快照（2026-09-24），用于设计迭代。
// 真机运行时这份数据由 src/lib/sessionScanner.js + projectScanner.js 产出。
var DATA = {
  view: 'board',
  glass: 'auto',
  claude: { installed: true },
  errors: [],
  stats: { projectCount: 5, sessionCount: 21, weekCount: 10 },

  // 8 周，每周真实提问数。0 的周是空周 —— 用户每周只干 4-6 小时，空白是真实信息。
  pulse: [0, 0, 0, 27, 75, 12, 31, 10],

  projects: [
    { name: 'NGS实验记录系统',       status: 'plan', docCount: 6, mtimeMs: 0, ago: '5 天前', summary: '医院 NGS 全流程实验记录，含三个平台的录入模板与数据库设计。' },
    { name: '日知录',                status: 'dev',  docCount: 1, mtimeMs: 0, ago: '5 天前', summary: '每日知识卡 PWA。商业化方向已审死，暂停在 Phase 0。' },
    { name: '语音输入助手',          status: 'live', docCount: 3, mtimeMs: 0, ago: '18 天前', summary: '语音输入 + 实时字幕 + 离线翻译，绿色版已打包实测通过。' },
    { name: '院内测序试剂管理系统',  status: 'arch', docCount: 1, mtimeMs: 0, ago: '5 天前', summary: null },
    { name: '漫剧测试片',            status: null,      docCount: 2, mtimeMs: 0, ago: '3 天前', summary: 'B 站觉醒漫剧计划 2.0 测试片，11/1 截止。' }
  ],

  sessions: [
    { id: 'b0a7e914', title: 'VS Code 侧边栏任务面板',                 promptCount: 5,  ago: '刚刚',   branch: 'master', empty: false },
    { id: '18e02b11', title: 'research-deliverable skill 研究回顾优化', promptCount: 5,  ago: '2 小时前', branch: 'master', empty: false },
    { id: 'd5eeb21a', title: 'oil-motion 仓库的 skill',                promptCount: 5,  ago: '3 天前', branch: 'master', empty: false },
    { id: 'ee26915b', title: 'Blender 3D建模协助',                     promptCount: 3,  ago: '5 天前', branch: 'master', empty: false },
    { id: '0a3d4003', title: 'show-me-the-money 开源项目选题',          promptCount: 15, ago: '3 天前', branch: 'master', empty: false },
    { id: '97b0d406', title: '跨领域每日知识推送应用',                  promptCount: 4,  ago: '3 天前', branch: 'master', empty: false },
    { id: '795b55a4', title: '个人作品集网站与工作台',                  promptCount: 5,  ago: '12 天前', branch: 'master', empty: false },
    { id: '13fc57d1', title: '模型存放位置',                            promptCount: 30, ago: '18 天前', branch: 'master', empty: false },
    { id: '2aede496', title: '语音转文字小软件',                        promptCount: 26, ago: '23 天前', branch: 'master', empty: false },
    { id: '7ce6a84f', title: '(空会话)',                                promptCount: 0,  ago: '刚刚',   branch: 'master', empty: true }
  ]
};
