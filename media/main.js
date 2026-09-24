// webview 交互层：通过消息协议读取和操作扩展侧数据。
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root');
  let state = null;
  let everRendered = false;
  let toastTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function projectId(project) { return window.projectId(project); }
  function statusColor(status) { return window.statusMeta(status).css; }

  function elementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  }

  function syncGlass() {
    const mode = (state && state.glass) || 'auto';
    const classes = document.body.classList;
    const highContrast = classes.contains('vscode-high-contrast')
      || classes.contains('vscode-high-contrast-light');
    const dark = classes.contains('vscode-dark');
    const enabled = !highContrast && (mode === 'on' || (mode === 'auto' && dark));
    classes.toggle('glass-on', enabled);
  }

  function syncStats(data) {
    const stats = data.stats || {};
    const values = [stats.projectCount, stats.sessionCount, stats.weekCount];
    root.querySelectorAll('.stats .stat__n').forEach((node, index) => {
      node.textContent = String(Number(values[index]) || 0);
    });
  }

  function pulseValues(data) {
    const values = asArray(data.pulse).slice(-8);
    while (values.length < 8) values.unshift(0);
    return values.map((value) => Math.max(0, Number(value) || 0));
  }

  function syncPulse(data) {
    const values = pulseValues(data);
    const max = Math.max(1, ...values);
    root.querySelectorAll('.pulse__b').forEach((node, index) => {
      const count = values[index] || 0;
      node.style.setProperty('--h', count ? String(Math.max(0.08, count / max)) : '0');
      node.style.setProperty('--i', String(index));
      node.dataset.empty = count ? '0' : '1';
      node.dataset.now = index === 7 ? '1' : '0';
      node.title = count + ' 次提问';
      node.setAttribute('aria-label', '第 ' + (index + 1) + ' 周：' + count + ' 次提问');
    });
  }

  function syncNotices(data) {
    const stage = root.querySelector('#stage');
    const errors = asArray(data.errors);
    let errorNotice = root.querySelector('#errors-notice');
    if (errors.length) {
      if (!errorNotice) {
        errorNotice = document.createElement('div');
        errorNotice.className = 'notice';
        errorNotice.id = 'errors-notice';
        stage.insertBefore(errorNotice, stage.firstChild);
      }
      errorNotice.textContent = errors.join(' · ');
    } else if (errorNotice) {
      errorNotice.remove();
    }

    let claudeNotice = root.querySelector('#claude-notice');
    if (data.claude && data.claude.installed === false) {
      if (!claudeNotice) {
        claudeNotice = document.createElement('div');
        claudeNotice.className = 'notice';
        claudeNotice.id = 'claude-notice';
        claudeNotice.textContent = '未检测到 Claude Code 扩展，只能预览、无法恢复会话。';
      }
      const sessions = root.querySelector('#sessions-section');
      if (sessions && claudeNotice.nextElementSibling !== sessions) stage.insertBefore(claudeNotice, sessions);
    } else if (claudeNotice) {
      claudeNotice.remove();
    }
  }

  function setStyle(node, property, value) {
    node.style.setProperty(property, value);
  }

  function updateMeta(container, parts) {
    container.replaceChildren();
    parts.filter((part) => part !== null && part !== undefined && part !== '').forEach((part, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'dot';
        container.appendChild(separator);
      }
      const value = document.createElement('span');
      value.textContent = String(part);
      container.appendChild(value);
    });
  }

  function syncProjectCard(node, project, index) {
    const title = node.querySelector('.card__t');
    title.textContent = project.name || '';
    title.title = project.name || '';
    let summary = node.querySelector('.card__d');
    if (project.summary) {
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'card__d';
        title.insertAdjacentElement('afterend', summary);
      }
      summary.textContent = project.summary;
    } else if (summary) {
      summary.remove();
    }
    updateMeta(node.querySelector('.card__m'), [
      (Number(project.docCount) || 0) + ' 份文档', null, project.ago || ''
    ]);
    node.dataset.id = projectId(project);
    setStyle(node, '--st', statusColor(project.status));
    setStyle(node, '--i', String(Math.min(index, 12)));
  }

  function syncProjectRow(node, project, index) {
    node.querySelector('.row__t').textContent = project.name || '';
    node.querySelector('.row__m').textContent = (Number(project.docCount) || 0) + ' 份 · ' + (project.ago || '');
    node.dataset.id = projectId(project);
    setStyle(node, '--st', statusColor(project.status));
    setStyle(node, '--i', String(Math.min(index, 12)));
  }

  function laneKey(status) { return status || '__none'; }

  function createLane(board, status) {
    const key = laneKey(status);
    const meta = window.statusMeta(status);
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.status = key;
    setStyle(lane, '--lane-c', meta.css);

    const head = document.createElement('div');
    head.className = 'lane__head';
    const dot = document.createElement('span');
    dot.className = 'lane__dot';
    const name = document.createElement('span');
    name.className = 'lane__name';
    name.textContent = status || '未标注';
    const count = document.createElement('span');
    count.className = 'lane__n';
    count.textContent = '0';
    head.append(dot, name, count);

    const list = document.createElement('div');
    list.className = 'lane__list';
    lane.append(head, list);

    const nextLane = Array.from(board.children).find((item) => (
      window.statusMeta(item.dataset.status === '__none' ? null : item.dataset.status).order > meta.order
    ));
    board.insertBefore(lane, nextLane || null);
    return lane;
  }

  function findLane(board, status) {
    const key = laneKey(status);
    return Array.from(board.querySelectorAll('.lane')).find((lane) => lane.dataset.status === key)
      || createLane(board, status);
  }

  function placeInOrder(container, nodes) {
    let cursor = container.firstElementChild;
    nodes.forEach((node) => {
      if (node === cursor) {
        cursor = cursor.nextElementSibling;
      } else {
        container.insertBefore(node, cursor);
      }
    });
  }

  function syncBoardProjects(section, projects, existing) {
    const board = section.querySelector('.board');
    const groups = new Map();
    projects.forEach((project, index) => {
      const key = projectId(project);
      let card = existing.get(key);
      if (!card) card = elementFromHtml(window.renderProjectCard(project, index));
      syncProjectCard(card, project, index);
      const lane = findLane(board, project.status);
      if (!groups.has(lane)) groups.set(lane, []);
      groups.get(lane).push(card);
      existing.delete(key);
    });
    existing.forEach((node) => node.remove());
    groups.forEach((cards, lane) => placeInOrder(lane.querySelector('.lane__list'), cards));

    Array.from(board.querySelectorAll('.lane')).forEach((lane) => {
      const cards = lane.querySelectorAll('.card');
      if (!cards.length) {
        lane.remove();
      } else {
        lane.querySelector('.lane__n').textContent = String(cards.length);
      }
    });
  }

  function syncListProjects(section, projects, existing) {
    const list = section.querySelector('.list');
    const ordered = projects.slice().sort((a, b) => window.statusMeta(a.status).order - window.statusMeta(b.status).order);
    const rows = [];
    ordered.forEach((project, index) => {
      const key = projectId(project);
      let row = existing.get(key);
      if (!row) row = elementFromHtml(window.renderProjectRow(project, index));
      syncProjectRow(row, project, index);
      rows.push(row);
      existing.delete(key);
    });
    existing.forEach((node) => node.remove());
    placeInOrder(list, rows);
  }

  function syncProjects(previous, next, viewChanged) {
    const section = root.querySelector('#project-section');
    if (viewChanged || (!previous.projects.length && next.projects.length) || (previous.projects.length && !next.projects.length)) {
      section.replaceWith(elementFromHtml(window.renderProjectSection(next, next.view)));
      return;
    }
    if (!next.projects.length) return;

    const existing = new Map();
    section.querySelectorAll('.card[data-id], .row[data-id]').forEach((node) => existing.set(node.dataset.id, node));
    if (next.view === 'list') syncListProjects(section, next.projects, existing);
    else syncBoardProjects(section, next.projects, existing);
    root.querySelector('#project-count').textContent = String(next.projects.length);
  }

  function makeActionButton(action, id, title, icon) {
    const button = document.createElement('button');
    button.className = 'card__btn';
    button.dataset.act = action;
    button.dataset.id = id;
    button.title = title;
    button.innerHTML = icon;
    return button;
  }

  function syncSessionNode(node, session, index, installed) {
    const title = session.title || '(空会话)';
    const titleNode = node.querySelector('.tl__t');
    titleNode.textContent = title;
    titleNode.title = title;
    const parts = [session.ago || '', (Number(session.promptCount) || 0) + ' 次提问'];
    if (session.branch) parts.push(session.branch);
    updateMeta(node.querySelector('.tl__m'), parts);
    node.dataset.id = session.id;
    node.toggleAttribute('data-empty', Boolean(session.empty));
    setStyle(node, '--st', session.empty ? 'var(--c-dim)' : 'var(--st-dev)');
    setStyle(node, '--node', nodeSize(session.promptCount));
    setStyle(node, '--i', String(Math.min(index, 12)));

    const actions = node.querySelector('.card__act');
    let openButton = actions.querySelector('[data-act="open"]');
    if (installed && !openButton) {
      openButton = makeActionButton('open', session.id, '在 Claude 中打开',
        '<svg viewBox="0 0 16 16"><path d="M13.5 8.5c0 2.5-2.5 4.5-5.5 4.5-.7 0-1.4-.1-2-.3L3 14l1-2.3C3.4 10.9 2.5 9.8 2.5 8.5 2.5 6 5 4 8 4s5.5 2 5.5 4.5z"/></svg>');
      actions.appendChild(openButton);
    } else if (!installed && openButton) {
      openButton.remove();
    }
    if (openButton) openButton.dataset.id = session.id;
    const previewButton = actions.querySelector('[data-act="preview"]');
    if (previewButton) previewButton.dataset.id = session.id;
  }

  function syncSessions(previous, next) {
    const previousSessions = previous.sessions;
    const sessions = next.sessions;
    const section = root.querySelector('#sessions-section');
    if (!previousSessions.length || !sessions.length) {
      if (previousSessions.length !== sessions.length) {
        const replacement = elementFromHtml(window.renderSessionsSection(next));
        const notice = root.querySelector('#claude-notice');
        section.replaceWith(replacement);
        if (notice) root.querySelector('#stage').insertBefore(notice, replacement);
      } else {
        root.querySelector('#sessions-count').textContent = String(next.stats.sessionCount || 0);
      }
      return;
    }

    const timeline = section.querySelector('.tl');
    const existing = new Map();
    timeline.querySelectorAll('.tl__i[data-id]').forEach((node) => existing.set(node.dataset.id, node));
    const installed = Boolean(next.claude && next.claude.installed);
    const nodes = [];
    sessions.forEach((session, index) => {
      let node = existing.get(session.id);
      if (!node) node = elementFromHtml(window.renderSession(session, index, installed));
      syncSessionNode(node, session, index, installed);
      nodes.push(node);
      existing.delete(session.id);
    });
    existing.forEach((node) => node.remove());
    placeInOrder(timeline, nodes);
    root.querySelector('#sessions-count').textContent = String(next.stats.sessionCount || 0);
  }

  function normalize(snapshot, previous) {
    const next = Object.assign({}, previous || {}, snapshot);
    next.view = next.view === 'list' ? 'list' : 'board';
    next.projects = asArray(next.projects);
    next.sessions = asArray(next.sessions);
    next.errors = asArray(next.errors);
    next.stats = next.stats || { projectCount: 0, sessionCount: next.sessions.length, weekCount: 0 };
    next.pulse = asArray(next.pulse);
    return next;
  }

  function renderInitial() {
    root.classList.add('app');
    root.innerHTML = window.renderApp(state, state.view);
    everRendered = true;
  }

  function updateState(snapshot) {
    const previous = state;
    state = normalize(snapshot, previous);
    syncGlass();
    if (!everRendered) {
      renderInitial();
      return;
    }

    const viewChanged = previous.view !== state.view;
    syncStats(state);
    syncPulse(state);
    syncProjects(previous, state, viewChanged);
    syncSessions(previous, state);
    syncNotices(state);
    syncDrawerAvailability();
  }

  function projectFor(id) {
    return state && state.projects.find((project) => projectId(project) === id);
  }

  function postProject(type, id) {
    const project = projectFor(id);
    if (!project) return;
    if (type === 'openProject') {
      vscode.postMessage({ type, path: project.path, readmePath: project.readmePath || null });
    } else {
      vscode.postMessage({ type, path: project.path });
    }
  }

  function setView(value) {
    if (!state || (value !== 'board' && value !== 'list') || value === state.view) return;
    const previous = state;
    state = Object.assign({}, state, { view: value });
    vscode.setState({ view: value });
    vscode.postMessage({ type: 'setView', value });
    syncProjects(previous, state, true);
  }

  function appendMetaValues(container, parts) {
    container.replaceChildren();
    parts.filter((part) => part !== null && part !== undefined && part !== '').forEach((part, index) => {
      if (index) {
        const separator = document.createElement('span');
        separator.textContent = '·';
        container.appendChild(separator);
      }
      const value = document.createElement('span');
      value.textContent = String(part);
      container.appendChild(value);
    });
  }

  function openPreview(payload) {
    const drawer = root.querySelector('#drawer');
    const meta = payload.meta || {};
    root.querySelector('.drawer__t').textContent = payload.title || '(空会话)';
    const details = [];
    if (meta.ago) details.push(meta.ago);
    details.push((Number(meta.promptCount) || 0) + ' 次提问');
    if (meta.branch) details.push(meta.branch);
    appendMetaValues(root.querySelector('.drawer__m'), details);
    root.querySelector('.quote').textContent = payload.firstPrompt || '没有可显示的真实提问。';

    const body = root.querySelector('.drawer__body');
    Array.from(body.children).slice(1).forEach((node) => node.remove());
    const values = asArray(payload.lastReplies);
    if (!values.length) {
      const empty = document.createElement('div');
      empty.className = 'empty__d';
      empty.textContent = '没有可显示的助手回复。';
      body.appendChild(empty);
    } else {
      values.forEach((reply) => {
        const item = document.createElement('div');
        item.className = 'reply';
        item.textContent = reply;
        body.appendChild(item);
      });
    }

    const openButton = root.querySelector('#drawer-open');
    openButton.dataset.id = payload.id || '';
    openButton.hidden = !(state && state.claude && state.claude.installed);
    root.querySelector('#scrim').classList.add('is-open');
    drawer.classList.add('is-open');
  }

  function closePreview() {
    if (!everRendered) return;
    root.querySelector('#scrim').classList.remove('is-open');
    root.querySelector('#drawer').classList.remove('is-open');
  }

  function syncDrawerAvailability() {
    const button = root.querySelector('#drawer-open');
    if (button) button.hidden = !(state && state.claude && state.claude.installed);
  }

  function showToast(message) {
    const stage = root.querySelector('#stage');
    let notice = root.querySelector('#toast-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'notice';
      notice.id = 'toast-notice';
      stage.appendChild(notice);
    }
    notice.setAttribute('role', message.level === 'error' ? 'alert' : 'status');
    notice.textContent = message.text || '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => notice.remove(), 3200);
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const button = target.closest('[data-act]');
    if (button) {
      event.stopPropagation();
      const action = button.dataset.act;
      if (action === 'docs') {
        const card = button.closest('.card[data-id]');
        if (card) postProject('openDocs', card.dataset.id);
      } else if (action === 'preview') {
        vscode.postMessage({ type: 'previewSession', id: button.dataset.id });
      } else if (action === 'open') {
        vscode.postMessage({ type: 'openSession', id: button.dataset.id });
      } else if (action === 'close') {
        closePreview();
      } else if (action === 'refresh') {
        vscode.postMessage({ type: 'refresh' });
      }
      return;
    }

    const segment = target.closest('.seg__btn');
    if (segment) {
      setView(segment.dataset.view);
      return;
    }

    const project = target.closest('.card[data-id], .row[data-id]');
    if (project) {
      postProject('openProject', project.dataset.id);
      return;
    }

    const session = target.closest('.tl__i[data-id]');
    if (session) vscode.postMessage({ type: 'previewSession', id: session.dataset.id });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && message.payload) {
      updateState(message.payload);
    } else if (message.type === 'preview' && message.payload && everRendered) {
      openPreview(message.payload);
    } else if (message.type === 'toast' && everRendered) {
      showToast(message);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePreview();
  });

  new MutationObserver(syncGlass).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
  syncGlass();
  vscode.postMessage({ type: 'ready' });
})();
