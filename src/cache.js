'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const VERSION = 1;

class SessionCache {
  constructor(storagePath) {
    this.filePath = path.join(storagePath, 'session-index.json');
  }

  async read() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (parsed?.version !== VERSION || !parsed.sessions || Array.isArray(parsed.sessions) ||
          typeof parsed.sessions !== 'object') return {};
      return parsed.sessions;
    } catch {
      return {};
    }
  }

  async write(sessions) {
    const entries = Array.isArray(sessions)
      ? sessions.map((session) => [session.id, session])
      : Object.entries(sessions || {});
    const cleanSessions = {};

    for (const [id, session] of entries) {
      if (!id || !session || typeof session !== 'object') continue;
      cleanSessions[id] = {
        id,
        file: session.file,
        size: session.size,
        mtimeMs: session.mtimeMs,
        title: session.title,
        titleSource: session.titleSource,
        realPromptCount: session.realPromptCount,
        userCount: session.userCount,
        assistantCount: session.assistantCount,
        firstTs: session.firstTs,
        lastTs: session.lastTs,
        models: Array.isArray(session.models) ? session.models.slice(0, 3) : [],
        gitBranch: session.gitBranch,
        isEmpty: session.isEmpty === true,
        promptTimestamps: Array.isArray(session.promptTimestamps) ? session.promptTimestamps : []
      };
    }

    const contents = JSON.stringify({ version: VERSION, sessions: cleanSessions });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(temporaryPath, contents, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}

module.exports = { SessionCache };
