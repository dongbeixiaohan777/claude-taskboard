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

// 抽屉是 main.js 用 querySelector 抓元素填内容的：选择器写错不会报错，
// 只会在点开抽屉时抛 null 异常（和 0.1.1 修的那个 bug 同一类）。这里把
// 「main.js 用到的抽屉选择器」和「渲染器真的产出了这些元素」钉在一起。
test('预览抽屉产出 main.js 需要的全部挂载点', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'media', 'views.js'), 'utf8'),
    { window, T: (key) => key });

  const html = window.renderDrawer();
  const required = [
    ['#drawer', /id="drawer"/],
    ['#scrim', /id="scrim"/],
    ['.drawer__t', /class="drawer__t"/],
    ['.drawer__m', /class="drawer__m"/],
    ['#dsec-prompt', /id="dsec-prompt"/],
    ['#dsec-prompt .quote', /id="dsec-prompt"[^>]*>\s*<div class="dsec__l">[^<]*<\/div>\s*<div class="quote">/],
    ['#dsec-reply .reply', /id="dsec-reply"[^>]*>\s*<div class="dsec__l">[^<]*<\/div>\s*<div class="reply">/],
    ['#dsec-first .dfirst__t', /id="dsec-first"[\s\S]*?<span class="dfirst__t">/],
    ['#drawer-open', /id="drawer-open"/]
  ];

  const missing = required.filter(([, pattern]) => !pattern.test(html)).map(([name]) => name);
  assert.deepEqual(missing, [], `抽屉缺少 main.js 会去抓的挂载点：${missing.join(', ')}`);
});
