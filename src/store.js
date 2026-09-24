'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const paths = require('./lib/paths');
const sessionScanner = require('./lib/sessionScanner');
const projectScanner = require('./lib/projectScanner');
const { relativeTime } = require('./lib/format');
const { SessionCache } = require('./cache');
const logger = require('./logger');
const { t } = require('./i18n');

function mondayOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function bucketPromptTimestamps(sessions, now = new Date()) {
  const currentMonday = mondayOf(now instanceof Date ? now : new Date(now));
  const starts = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    starts.push(start);
  }

  const buckets = new Array(8).fill(0);
  for (const session of sessions || []) {
    for (const timestamp of session?.promptTimestamps || []) {
      const date = new Date(timestamp);
      if (!Number.isFinite(date.getTime())) continue;
      for (let i = 0; i < starts.length; i++) {
        const end = new Date(starts[i]);
        end.setDate(end.getDate() + 7);
        if (date >= starts[i] && date < end) {
          buckets[i]++;
          break;
        }
      }
    }
  }
  return buckets;
}

class BoardStore {
  constructor(context) {
    this.context = context;
    this.vscode = require('vscode');
    this._emitter = new this.vscode.EventEmitter();
    context.subscriptions.push(this._emitter);
    this._cache = new SessionCache(context.globalStorageUri.fsPath);
    this._projects = [];
    this._sessions = [];
    this._pulse = new Array(8).fill(0);
    this._errors = [];
    this._refreshPromise = null;
  }

  onDidChange(callback) {
    return this._emitter.event(callback);
  }

  getSnapshot() {
    const view = this.context.workspaceState.get('taskboard.view', 'board');
    const snapshotView = view === 'list' ? 'list' : 'board';
    const claude = require('./claude');

    return {
      view: snapshotView,
      glass: this.vscode.workspace.getConfiguration('taskboard').get('glassEffect') || 'auto',
      stats: {
        projectCount: this._projects.length,
        sessionCount: this._sessions.length,
        weekCount: this._pulse[this._pulse.length - 1]
      },
      pulse: [...this._pulse],
      projects: this._projects.map((project) => ({
        name: project.name,
        status: project.status,
        docCount: project.docCount,
        ago: project.mtimeMs === null ? '' : relativeTime(new Date(project.mtimeMs).toISOString()),
        summary: project.summary,
        readmePath: project.readmePath,
        path: project.path
      })),
      sessions: this._sessions.map((session) => ({
        id: session.id,
        title: session.title,
        promptCount: session.realPromptCount,
        ago: session.lastTs ? relativeTime(session.lastTs) : '',
        branch: session.gitBranch,
        empty: session.isEmpty
      })),
      claude: { installed: claude.isInstalled() },
      errors: [...this._errors]
    };
  }

  async setView(view) {
    const value = view === 'list' ? 'list' : 'board';
    try {
      await this.context.workspaceState.update('taskboard.view', value);
    } catch (error) {
      logger.error('保存视图失败', error);
    }
    this._emitter.fire(this.getSnapshot());
  }

  async refresh(force = false) {
    if (this._refreshPromise) {
      const running = this._refreshPromise;
      if (!force) return running;
      await running.catch(() => {});
      if (this._refreshPromise === running) this._refreshPromise = null;
      return this.refresh(true);
    }
    const pending = this._refresh(force);
    this._refreshPromise = pending;
    try {
      return await pending;
    } finally {
      if (this._refreshPromise === pending) this._refreshPromise = null;
    }
  }

  async _refresh(force) {
    const errors = [];
    const workspaceRoot = this.vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this._projects = [];
    this._sessions = [];

    if (!workspaceRoot) {
      errors.push(t('notice.noWorkspace'));
      this._pulse = new Array(8).fill(0);
      this._errors = errors;
      this._emitter.fire(this.getSnapshot());
      return this.getSnapshot();
    }

    let sessionDir = null;
    try {
      sessionDir = await paths.findSessionDirFor(workspaceRoot, paths.claudeProjectsRoot());
      if (!sessionDir) errors.push(t('notice.sessionDirMissing'));
    } catch (error) {
      logger.error('查找会话目录失败', error);
      errors.push(t('notice.locateSessionFailed'));
    }

    if (sessionDir) {
      try {
        const cachedSessions = await this._cache.read();
        this._sessions = await sessionScanner.scanProjectDir(sessionDir, {
          cachedSessions,
          force,
          onError: (filePath, error) => {
            logger.error(`读取会话失败：${path.basename(filePath)}`, error);
            errors.push(t('notice.readSessionsFailed'));
          }
        });
        try {
          await this._cache.write(this._sessions);
        } catch (error) {
          logger.error('写入会话缓存失败', error);
          errors.push(t('notice.cacheWriteFailed'));
        }
      } catch (error) {
        logger.error('扫描会话目录失败', error);
        errors.push(t('notice.scanSessionsFailed'));
        this._sessions = [];
      }
    }

    try {
      // 用 resolveProjectsDir：设置项已注册为默认 ""，直接 get(section, fallback)
      // 拿不到 fallback（那是死代码），会返回空字符串导致 fs.access 抛错。
      const projectsDir = await paths.resolveProjectsDir(
        workspaceRoot,
        this.vscode.workspace.getConfiguration('taskboard').get('projectsDir')
      );
      if (!projectsDir) throw Object.assign(new Error('无法确定项目目录'), { code: 'ENOENT' });
      await fs.access(projectsDir);
      this._projects = await projectScanner.scanProjects(projectsDir);
    } catch (error) {
      logger.error('扫描项目目录失败', error);
      errors.push(t(error.code === 'ENOENT' || error.code === 'ENOTDIR'
        ? 'notice.projectsDirMissing'
        : 'notice.scanProjectsFailed'));
      this._projects = [];
    }

    this._pulse = bucketPromptTimestamps(this._sessions);
    this._errors = [...new Set(errors)];
    this._emitter.fire(this.getSnapshot());
    return this.getSnapshot();
  }

  async readPreview(id) {
    const session = this._sessions.find((item) => item.id === id);
    if (!session) return null;
    const preview = await sessionScanner.readSessionPreview(session.file, { maxReplies: 3 });
    return {
      id: session.id,
      title: session.title,
      firstPrompt: preview.firstPrompt,
      lastReplies: preview.lastReplies,
      meta: {
        ago: session.lastTs ? relativeTime(session.lastTs) : '',
        branch: session.gitBranch,
        promptCount: session.realPromptCount,
        models: (session.models || []).slice(0, 3)
      }
    };
  }
}

module.exports = { BoardStore, bucketPromptTimestamps };
