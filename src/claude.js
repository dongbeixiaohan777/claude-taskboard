'use strict';

const vscode = require('vscode');
const logger = require('./logger');

// 本集成基于 anthropic.claude-code 2.1.281 逆向。若将来失效，改这里的常量。
const CLAUDE_EXT_ID = 'anthropic.claude-code';
const OPEN_CMD = 'claude-vscode.editor.open';
const uriFor = (id) => `vscode://anthropic.claude-code/open?session=${encodeURIComponent(id)}`;

function getExtension() {
  try {
    return vscode.extensions.getExtension(CLAUDE_EXT_ID);
  } catch (error) {
    logger.error('检查 Claude Code 扩展失败', error);
    return undefined;
  }
}

function isInstalled() {
  return Boolean(getExtension());
}

function getVersion() {
  const extension = getExtension();
  const version = extension?.packageJSON?.version;
  return typeof version === 'string' ? version : null;
}

async function openSession(sessionId) {
  const extension = getExtension();
  if (!extension) {
    logger.log('未检测到 Claude Code 扩展');
    return { ok: false, reason: 'not-installed' };
  }

  if (!extension.isActive) {
    try {
      await extension.activate();
      logger.log(`Claude Code 扩展已激活（${getVersion() || '版本未知'}）`);
    } catch (error) {
      logger.error('激活 Claude Code 扩展失败', error);
    }
  }

  try {
    await vscode.commands.executeCommand(OPEN_CMD, sessionId);
    logger.log(`已通过命令打开 Claude 会话 ${sessionId}`);
    return { ok: true, via: 'command' };
  } catch (error) {
    logger.error('Claude 会话命令失败，改用公开深链', error);
  }

  try {
    const opened = await vscode.env.openExternal(vscode.Uri.parse(uriFor(sessionId)));
    if (opened === false) throw new Error('VS Code 未能打开 Claude 会话深链');
    logger.log(`已通过深链打开 Claude 会话 ${sessionId}`);
    return { ok: true, via: 'uri' };
  } catch (error) {
    logger.error('Claude 会话深链失败', error);
    return { ok: false, reason: 'failed' };
  }
}

module.exports = { CLAUDE_EXT_ID, OPEN_CMD, uriFor, isInstalled, getVersion, openSession };
