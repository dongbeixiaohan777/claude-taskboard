'use strict';

const vscode = require('vscode');
const logger = require('./logger');
const { BoardStore } = require('./store');
const { TaskboardViewProvider } = require('./panel');
const { startWatching } = require('./watcher');
const claude = require('./claude');

async function activate(context) {
  const output = logger.init();
  context.subscriptions.push(output);
  logger.log(`扩展已激活 · VS Code ${vscode.version}`);
  const version = claude.getVersion();
  logger.log(version ? `Claude Code 扩展版本：${version}` : '未检测到 Claude Code 扩展');

  const store = new BoardStore(context);
  const provider = new TaskboardViewProvider(context, store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('taskboard.main', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('taskboard.refresh', () => store.refresh(true)),
    vscode.commands.registerCommand('taskboard.toggle', () => provider.toggleView()),
    startWatching(store, () => provider.isVisible),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('taskboard.glassEffect')) {
        store.refresh().catch((error) => logger.error('玻璃设置变更后刷新失败', error));
      }
    })
  );

  store.refresh().catch((error) => logger.error('启动预热失败', error));
}

function deactivate() {
  // 扩展订阅由 VS Code 在停用时统一释放。
}

module.exports = { activate, deactivate };
