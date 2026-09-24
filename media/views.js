// 渲染层：沙盘和扩展 webview 共用这一份 DOM 结构。
(function () {
  'use strict';

  var STATUS_META = {
    '规划中': { css: 'var(--st-plan)', order: 0 },
    '开发中': { css: 'var(--st-dev)', order: 1 },
    '已上线': { css: 'var(--st-live)', order: 2 },
    '已完成': { css: 'var(--st-live)', order: 2 },
    '已归档': { css: 'var(--st-arch)', order: 3 }
  };
  var STATUS_NONE = { css: 'var(--st-none)', order: 4 };

  function statusMeta(status) { return STATUS_META[status] || STATUS_NONE; }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/[&<>"']/g, function (character) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
      });
  }

  function projectId(project) { return project.path || project.name || ''; }

  function nodeSize(count) {
    count = Number(count) || 0;
    if (!count) return '5px';
    if (count <= 2) return '6px';
    if (count <= 5) return '8px';
    return '10px';
  }

  var ICON = {
    eye: '<svg viewBox="0 0 16 16"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/></svg>',
    open: '<svg viewBox="0 0 16 16"><path d="M6.5 3.5H3.5v9h9v-3"/><path d="M9.5 3.5h3v3"/><path d="M12.5 3.5 7.5 8.5"/></svg>',
    chat: '<svg viewBox="0 0 16 16"><path d="M13.5 8.5c0 2.5-2.5 4.5-5.5 4.5-.7 0-1.4-.1-2-.3L3 14l1-2.3C3.4 10.9 2.5 9.8 2.5 8.5 2.5 6 5 4 8 4s5.5 2 5.5 4.5z"/></svg>'
  };

  function renderStats(data) {
    var stats = data.stats || {};
    return '<div class="stats">' +
      '<div class="stat"><span class="stat__n">' + (Number(stats.projectCount) || 0) + '</span><span class="stat__l">项目</span></div>' +
      '<div class="stat"><span class="stat__n">' + (Number(stats.sessionCount) || 0) + '</span><span class="stat__l">会话</span></div>' +
      '<div class="stat stat--hot"><span class="stat__n">' + (Number(stats.weekCount) || 0) + '</span><span class="stat__l">本周</span></div>' +
      '</div>';
  }

  function renderSeg(view) {
    var boardOn = view !== 'list';
    return '<div class="seg" data-i="' + (boardOn ? '0' : '1') + '" role="tablist" aria-label="视图切换">' +
      '<button class="seg__btn' + (boardOn ? ' is-on' : '') + '" data-view="board" role="tab" aria-selected="' + boardOn + '">看板</button>' +
      '<button class="seg__btn' + (!boardOn ? ' is-on' : '') + '" data-view="list" role="tab" aria-selected="' + !boardOn + '">列表</button>' +
      '<span class="seg__thumb" aria-hidden="true"></span></div>';
  }

  function renderProjectCard(project, index) {
    var meta = statusMeta(project.status);
    return '<article class="card" data-id="' + escapeHtml(projectId(project)) + '" style="--st:' + meta.css + ';--i:' + Math.min(index, 12) + '">' +
      '<div class="card__t" title="' + escapeHtml(project.name) + '">' + escapeHtml(project.name) + '</div>' +
      (project.summary ? '<div class="card__d">' + escapeHtml(project.summary) + '</div>' : '') +
      '<div class="card__m"><span>' + (Number(project.docCount) || 0) + ' 份文档</span><span class="dot"></span><span>' + escapeHtml(project.ago) + '</span></div>' +
      '<div class="card__act"><button class="card__btn" data-act="docs" title="打开项目文档">' + ICON.open + '</button></div>' +
      '</article>';
  }

  function renderProjectRow(project, index) {
    var meta = statusMeta(project.status);
    return '<div class="row" data-id="' + escapeHtml(projectId(project)) + '" style="--st:' + meta.css + ';--i:' + Math.min(index, 12) + '">' +
      '<span class="row__dot"></span>' +
      '<span class="row__t">' + escapeHtml(project.name) + '</span>' +
      '<span class="row__m">' + (Number(project.docCount) || 0) + ' 份 · ' + escapeHtml(project.ago) + '</span>' +
      '</div>';
  }

  function renderBoard(projects) {
    var buckets = Object.create(null);
    projects.forEach(function (project) {
      var key = project.status || '__none';
      var meta = statusMeta(project.status);
      if (!buckets[key]) buckets[key] = { label: project.status || '未标注', css: meta.css, order: meta.order, items: [] };
      buckets[key].items.push(project);
    });

    var keys = Object.keys(buckets).sort(function (a, b) { return buckets[a].order - buckets[b].order; });
    var index = 0;
    return '<div class="board">' + keys.map(function (key) {
      var lane = buckets[key];
      return '<div class="lane" data-status="' + escapeHtml(key) + '" style="--lane-c:' + lane.css + '">' +
        '<div class="lane__head"><span class="lane__dot"></span><span class="lane__name">' + escapeHtml(lane.label) + '</span>' +
        '<span class="lane__n">' + lane.items.length + '</span></div>' +
        '<div class="lane__list">' + lane.items.map(function (project) { return renderProjectCard(project, index++); }).join('') + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderProjectList(projects) {
    var items = projects.slice().sort(function (a, b) {
      return statusMeta(a.status).order - statusMeta(b.status).order;
    });
    return '<div class="list">' + items.map(renderProjectRow).join('') + '</div>';
  }

  function renderProjectSection(data, view) {
    var projects = Array.isArray(data.projects) ? data.projects : [];
    var content = !projects.length
      ? '<div class="empty"><div class="empty__t">暂无项目</div><div class="empty__d">检查项目目录设置，或在 02-项目目录中添加项目文件夹。</div></div>'
      : (view === 'list' ? renderProjectList(projects) : renderBoard(projects));
    return '<section class="section" id="project-section"><div class="section__head">' +
      '<h2 class="section__title">项目</h2><span class="section__count" id="project-count">' + projects.length + '</span>' +
      renderSeg(view) + '</div>' + content + '</section>';
  }

  function renderPulse(data) {
    var pulse = Array.isArray(data.pulse) ? data.pulse.slice(-8) : [];
    while (pulse.length < 8) pulse.unshift(0);
    var counts = pulse.map(function (value) { return Math.max(0, Number(value) || 0); });
    var max = Math.max.apply(null, counts.concat([1]));
    return '<div class="pulse" aria-label="最近八周提问数"><div class="pulse__bars">' +
      counts.map(function (count, index) {
        var height = count === 0 ? 0 : Math.max(0.08, count / max).toFixed(3);
        return '<span class="pulse__b" style="--h:' + height + ';--i:' + index + '" data-empty="' + (count ? '0' : '1') + '" data-now="' + (index === 7 ? '1' : '0') + '" title="' + count + ' 次提问" aria-label="第 ' + (index + 1) + ' 周：' + count + ' 次提问"></span>';
      }).join('') +
      '</div><div class="pulse__axis"><span>8 周前</span><span>每周提问数</span><span>本周</span></div></div>';
  }

  function renderSession(session, index, installed) {
    var status = session.empty ? 'var(--c-dim)' : 'var(--st-dev)';
    var openButton = installed
      ? '<button class="card__btn" data-act="open" data-id="' + escapeHtml(session.id) + '" title="在 Claude 中打开">' + ICON.chat + '</button>'
      : '';
    return '<div class="tl__i" data-id="' + escapeHtml(session.id) + '"' +
      (session.empty ? ' data-empty="1"' : '') +
      ' style="--st:' + status + ';--node:' + nodeSize(session.promptCount) + ';--i:' + Math.min(index, 12) + '">' +
      '<div class="tl__t" title="' + escapeHtml(session.title || '(空会话)') + '">' + escapeHtml(session.title || '(空会话)') + '</div>' +
      '<div class="tl__m"><span>' + escapeHtml(session.ago) + '</span><span class="dot"></span><span>' + (Number(session.promptCount) || 0) + ' 次提问</span>' +
      (session.branch ? '<span class="dot"></span><span>' + escapeHtml(session.branch) + '</span>' : '') +
      '</div><div class="card__act"><button class="card__btn" data-act="preview" data-id="' + escapeHtml(session.id) + '" title="预览">' + ICON.eye + '</button>' +
      openButton + '</div></div>';
  }

  function renderSessionsSection(data) {
    var sessions = Array.isArray(data.sessions) ? data.sessions : [];
    var content = sessions.length
      ? '<div class="tl">' + sessions.map(function (session, index) {
        return renderSession(session, index, Boolean(data.claude && data.claude.installed));
      }).join('') + '</div>'
      : '<div class="empty"><div class="empty__t">暂无会话</div><div class="empty__d">打开 Claude Code 并开始对话后，会话会出现在这里。</div></div>';
    var count = data.stats ? Number(data.stats.sessionCount) || 0 : sessions.length;
    return '<section class="section" id="sessions-section"><div class="section__head">' +
      '<h2 class="section__title">会话</h2><span class="section__count" id="sessions-count">' + count + '</span>' +
      '</div>' + content + '</section>';
  }

  function renderTopbar() {
    return '<header class="topbar"><span class="topbar__mark" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<h1 class="topbar__title">任务面板</h1></header>';
  }

  function renderDrawer() {
    return '<div class="scrim" id="scrim" data-act="close"></div>' +
      '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="会话预览">' +
      '<div class="drawer__grip"></div><div class="drawer__head"><div class="drawer__t"></div><div class="drawer__m"></div></div>' +
      '<div class="drawer__body"><div class="quote"></div></div>' +
      '<div class="drawer__foot"><button class="btn" data-act="open" id="drawer-open">在 Claude 中打开</button>' +
      '<button class="btn btn--2" data-act="close">关闭</button></div></aside>';
  }

  function renderApp(data, view) {
    var errors = Array.isArray(data.errors) ? data.errors : [];
    var notice = errors.length
      ? '<div class="notice" id="errors-notice">' + escapeHtml(errors.join(' · ')) + '</div>'
      : '';
    var claudeNotice = data.claude && data.claude.installed === false
      ? '<div class="notice" id="claude-notice">未检测到 Claude Code 扩展，只能预览、无法恢复会话。</div>'
      : '';
    return renderTopbar() + '<main id="stage" class="stage" aria-live="polite">' + notice +
      renderStats(data) + renderPulse(data) + renderProjectSection(data, view) +
      claudeNotice + renderSessionsSection(data) + '</main>' + renderDrawer();
  }

  window.renderApp = renderApp;
  window.renderProjectSection = renderProjectSection;
  window.renderSessionsSection = renderSessionsSection;
  window.renderProjectCard = renderProjectCard;
  window.renderProjectRow = renderProjectRow;
  window.renderSession = renderSession;
  window.projectId = projectId;
  window.statusMeta = statusMeta;
})();
