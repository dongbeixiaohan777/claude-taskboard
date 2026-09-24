'use strict';

let channel;

function init() {
  const vscode = require('vscode');
  channel = vscode.window.createOutputChannel('任务面板');
  return channel;
}

function log(msg) {
  channel?.appendLine(`[任务面板] ${msg}`);
}

function error(msg, err) {
  channel?.appendLine(`[任务面板][错误] ${msg}${err ? ' · ' + (err.stack || err.message || err) : ''}`);
}

module.exports = { init, log, error };
