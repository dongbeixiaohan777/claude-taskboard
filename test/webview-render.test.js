'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('渲染器输出带状态编码的看板与可操作的会话节点', () => {
  const i18nPath = path.join(__dirname, '..', 'media', 'i18n.js');
  const viewsPath = path.join(__dirname, '..', 'media', 'views.js');
  assert.ok(fs.existsSync(viewsPath), 'media/views.js 应提供浏览器渲染器');

  const window = {};
  vm.runInNewContext(fs.readFileSync(i18nPath, 'utf8'), { window });
  vm.runInNewContext(fs.readFileSync(viewsPath, 'utf8'), { window, T: window.T });

  const data = {
    stats: { projectCount: 1, sessionCount: 1, weekCount: 3 },
    pulse: [0, 0, 0, 0, 0, 0, 0, 3],
    projects: [{
      name: '<project>', status: 'dev', docCount: 2, ago: '5 天前',
      summary: null, path: 'project-path-1', readmePath: null
    }],
    sessions: [{
      id: 'session-1', title: '<session>', promptCount: 6,
      ago: '刚刚', branch: 'main', empty: false
    }],
    claude: { installed: true },
    errors: ['读取失败 <detail>']
  };

  const board = window.renderApp(data, 'board');
  assert.match(board, /class="lane"[^>]*--lane-c:var\(--st-dev\)/);
  assert.match(board, /class="card" data-id="project-path-1"[^>]*--st:var\(--st-dev\)/);
  assert.match(board, /data-act="docs"[^>]*><svg/);
  assert.match(board, /class="tl__i" data-id="session-1"[^>]*--node:10px/);
  assert.match(board, /data-act="preview"/);
  assert.match(board, /data-act="open"/);
  assert.match(board, /class="notice"[^>]*>读取失败 &lt;detail&gt;/);
  assert.match(board, /<h1 class="topbar__title">Taskboard<\/h1>/);
  assert.doesNotMatch(board, /<project>|<session>/);

  const list = window.renderApp({ ...data, claude: { installed: false }, errors: [] }, 'list');
  assert.match(list, /class="row" data-id="project-path-1"[^>]*--st:var\(--st-dev\)/);
  assert.match(list, /Claude Code extension not found — preview works, but sessions cannot be reopened\./);
  assert.equal((list.match(/data-act="open"/g) || []).length, 1);

  window.initI18n('zh-cn');
  const chinese = window.renderApp(data, 'board');
  assert.match(chinese, /<h1 class="topbar__title">任务面板<\/h1>/);
  assert.match(chinese, /<span class="lane__name">开发中<\/span>/);
});
