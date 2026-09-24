'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');
const claude = require('./claude');
const logger = require('./logger');

class TaskboardViewProvider {
  constructor(context, store) {
    this.context = context;
    this.store = store;
    this.view = undefined;
    context.subscriptions.push(this.store.onDidChange((snapshot) => this.postState(snapshot)));
  }

  get isVisible() {
    return Boolean(this.view?.visible);
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    this.context.subscriptions.push(
      webviewView.webview.onDidReceiveMessage((message) => {
        void this.handleMessage(message).catch((error) => {
          logger.error('处理面板消息失败', error);
          this.toast('操作没有完成，请稍后重试。', 'error');
        });
      }),
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this.store.refresh().catch((error) => logger.error('面板显示时刷新失败', error));
        }
      }),
      webviewView.onDidDispose(() => {
        if (this.view === webviewView) this.view = undefined;
      })
    );
  }

  async handleMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ready') {
      this.postState();
    } else if (message.type === 'refresh') {
      await this.store.refresh(true);
    } else if (message.type === 'setView') {
      if (message.value === 'board' || message.value === 'list') await this.store.setView(message.value);
    } else if (message.type === 'openSession') {
      await this.openSession(message.id);
    } else if (message.type === 'previewSession') {
      await this.previewSession(message.id);
    } else if (message.type === 'openProject') {
      await this.openProject(message.path, message.readmePath);
    } else if (message.type === 'openDocs') {
      await this.openDocs(message.path);
    }
  }

  async openSession(id) {
    if (typeof id !== 'string' || !id) return;
    const result = await claude.openSession(id);
    if (result.ok) return;
    if (result.reason === 'not-installed') {
      this.toast('尚未安装 Claude Code 扩展，正在打开扩展页面。', 'info');
      // 用 vscode:extension/ 让 VS Code 内部打开扩展页；不要用网页市场链接，
      // 国内访问 marketplace.visualstudio.com 很慢，且会跳出编辑器。
      try {
        await vscode.commands.executeCommand(
          'workbench.extensions.search', `@id:${claude.CLAUDE_EXT_ID}`
        );
      } catch (error) {
        logger.error('打开扩展页面失败', error);
      }
      return;
    }
    this.toast('Claude Code 暂时无法打开这个会话。', 'error');
  }

  async previewSession(id) {
    if (typeof id !== 'string' || !id) return;
    try {
      const payload = await this.store.readPreview(id);
      if (!payload) {
        this.toast('找不到这个会话，请刷新后重试。', 'error');
        return;
      }
      this.postMessage({ type: 'preview', payload });
    } catch (error) {
      logger.error('读取会话预览失败', error);
      this.toast('暂时无法读取会话预览。', 'error');
    }
  }

  async openProject(projectPath, readmePath) {
    if (typeof projectPath !== 'string' || !projectPath) return;
    const target = typeof readmePath === 'string' && readmePath
      ? readmePath
      : path.join(projectPath, 'README.md');
    try {
      await fs.access(target);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(document);
    } catch (error) {
      logger.error('打开项目 README 失败', error);
      this.toast('这个项目还没有可打开的 README.md。', 'info');
    }
  }

  async openDocs(targetPath) {
    if (typeof targetPath !== 'string' || !targetPath) return;
    try {
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(targetPath));
    } catch (error) {
      logger.error('在资源管理器中定位项目失败', error);
      this.toast('暂时无法在资源管理器中定位这个目录。', 'error');
    }
  }

  async toggleView() {
    const next = this.store.getSnapshot().view === 'board' ? 'list' : 'board';
    await this.store.setView(next);
  }

  postState(snapshot = this.store.getSnapshot()) {
    this.postMessage({ type: 'state', payload: snapshot });
  }

  toast(text, level = 'info') {
    this.postMessage({ type: 'toast', text, level });
  }

  postMessage(message) {
    try {
      Promise.resolve(this.view?.webview.postMessage(message)).catch((error) => {
        logger.error('发送面板消息失败', error);
      });
    } catch (error) {
      logger.error('发送面板消息失败', error);
    }
  }

  getHtml(webview) {
    const nonce = makeNonce();
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css')
    );
    const glassUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'glass.css')
    );
    const viewsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'views.js')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')
    );
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${cssUri}">
<!-- 液态玻璃层：只在深色主题下生效，浅色保持扁平。规则见 glass.css 顶部注释 -->
<link rel="stylesheet" href="${glassUri}">
<title>任务面板</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${viewsUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function makeNonce() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  while (nonce.length < 32) {
    for (const value of crypto.randomBytes(32)) {
      if (value < 248) nonce += alphabet[value % alphabet.length];
      if (nonce.length === 32) break;
    }
  }
  return nonce;
}

module.exports = { TaskboardViewProvider };
