'use strict';

const path = require('node:path');
const vscode = require('vscode');
const paths = require('./lib/paths');
const logger = require('./logger');

function startWatching(store, isVisible) {
  const watchers = [];
  let timeout = null;
  let dirty = false;
  let disposed = false;
  let initializing = false;
  let sessionWatched = false;
  let projectsWatched = false;

  function visible() {
    try {
      return typeof isVisible === 'function' ? Boolean(isVisible()) : Boolean(isVisible);
    } catch {
      return false;
    }
  }

  function refreshSoon() {
    dirty = true;
    if (!visible()) return;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (!visible()) return;
      dirty = false;
      store.refresh().catch((error) => logger.error('监听触发刷新失败', error));
    }, 1500);
  }

  function addWatcher(directory, pattern) {
    try {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(directory), pattern)
      );
      watchers.push(watcher);
      watchers.push(watcher.onDidCreate(refreshSoon));
      watchers.push(watcher.onDidChange(refreshSoon));
      watchers.push(watcher.onDidDelete(refreshSoon));
      return true;
    } catch (error) {
      logger.error(`创建文件监听失败：${path.basename(directory)}`, error);
      return false;
    }
  }

  async function initialize() {
    if (initializing || disposed) return;
    initializing = true;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      initializing = false;
      return;
    }

    try {
      if (!sessionWatched) {
        const sessionDir = await paths.findSessionDirFor(workspaceRoot, paths.claudeProjectsRoot());
        if (sessionDir && !disposed) sessionWatched = addWatcher(sessionDir, '*.jsonl');
      }
    } catch (error) {
      logger.error('初始化会话监听失败', error);
    }

    try {
      if (!projectsWatched) {
        // 同 store.js：必须走 resolveProjectsDir，不能依赖 get() 的 fallback
        const projectsDir = paths.resolveProjectsDir(
          workspaceRoot,
          vscode.workspace.getConfiguration('taskboard').get('projectsDir')
        );
        if (!projectsDir) return;
        await require('node:fs/promises').access(projectsDir);
        if (!disposed) projectsWatched = addWatcher(projectsDir, '*');
      }
    } catch (error) {
      logger.error('初始化项目监听失败', error);
    } finally {
      initializing = false;
    }
  }

  const poll = setInterval(() => {
    if (!sessionWatched || !projectsWatched) void initialize();
    if (!visible()) return;
    if (dirty) dirty = false;
    store.refresh().catch((error) => logger.error('定时刷新失败', error));
  }, 30_000);
  void initialize();

  return new vscode.Disposable(() => {
    disposed = true;
    clearTimeout(timeout);
    clearInterval(poll);
    for (const watcher of watchers) watcher.dispose();
  });
}

module.exports = { startWatching };
