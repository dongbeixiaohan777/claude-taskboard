# Codex 任务书 03 — 扩展外壳（数据装配 + Claude 集成）

## 背景

项目：VS Code 扩展「任务面板」（`vscode-taskboard`），独立 git 仓库。
数据层 `src/lib/*` 已完成（任务书 01 + 02）。

现在的 `src/extension.js` 是一个**只有占位内容的早期骨架**，本任务要把它拆成正式结构。

## 硬性约束（违反直接炸）

1. **CommonJS。** 禁止 `import`/`export`。本项目**故意不写** `"type": "module"` ——
   VS Code 扩展宿主里 ESM 会让 `require('vscode')` 报 `require is not defined`。
2. **零构建步骤。** 没有 TypeScript、没有打包器。
3. `src/lib/*` 已经写好，**不要改它们**（除非任务书 02 的修正还没落地，那另说）。
   本任务的文件在 `src/` 根层，**这些文件可以 `require('vscode')`**。
4. 中文注释。
5. 只依赖 Node 内置模块 + `vscode`。**不引入任何第三方包。**
6. 用户是**编程小白**：所有失败路径都要优雅降级，不能崩、不能弹看不懂的错误。

---

## 要产出的文件

```
src/logger.js     输出通道封装
src/cache.js      扫描结果落盘缓存
src/store.js      唯一数据源：扫描 + 缓存 + 事件 + 快照
src/claude.js     Claude 扩展集成（★ 最需要小心）
src/watcher.js    文件监听 + 去抖
src/panel.js      WebviewViewProvider
src/extension.js  重写为纯装配（activate/deactivate）
```

---

## 1. `src/logger.js`

```js
const vscode = require('vscode');
let channel;
function init() { channel = vscode.window.createOutputChannel('任务面板'); return channel; }
function log(msg)   { channel?.appendLine(`[任务面板] ${msg}`); }
function error(msg, err) { channel?.appendLine(`[任务面板][错误] ${msg}${err ? ' · ' + (err.stack || err.message || err) : ''}`); }
module.exports = { init, log, error };
```

用途：用户排查问题的唯一窗口。README 里会教他 `Ctrl+Shift+P` → `Output: Focus on Output View`
→ 下拉选「任务面板」。

---

## 2. `src/cache.js`

缓存扫描结果，避免每次全量重扫 84MB。

- 位置：`context.globalStorageUri.fsPath/session-index.json`（写前先 `fs.mkdir(dir,{recursive:true})`）
- 结构：`{ version: 1, sessions: { [id]: SessionMeta } }`
- 失效判定：`stat.size === cached.size && stat.mtimeMs === cached.mtimeMs` → 复用，否则重扫该文件
- **写盘用原子写**：先写 `.tmp` 再 `fs.rename`。否则 VS Code 被强杀时留下半截 JSON，
  下次启动直接解析失败。
- 读盘失败（文件不存在/坏 JSON/版本不符）→ 静默返回空缓存，**不要抛**
- `SessionMeta` 里不要存绝对路径以外的大字段；`models` 数组截断到 3 个

---

## 3. `src/store.js`

导出 `class BoardStore`。

```js
class BoardStore {
  constructor(context) { ... }

  /** @param {boolean} force 忽略缓存全量重扫 */
  async refresh(force = false) { ... }

  getSnapshot() { ... }

  onDidChange(cb) { ... }   // 用 vscode.EventEmitter
}
```

`refresh()` 流程：
1. 找会话目录：`paths.findSessionDirFor(workspaceRoot, paths.claudeProjectsRoot())`
   —— **用这个函数，不要自己拼目录名**。它用 jsonl 里的 `cwd` 字段反查，比猜编码规则可靠
2. 找项目目录：配置项 `taskboard.projectsDir`，默认 `d:\Claude\KB\02-项目`
3. `sessionScanner.scanProjectDir()` + `projectScanner.scanProjects()`
4. 写缓存
5. `fire(snapshot)`

**workspaceRoot 取值**：`vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`。
取不到（没打开文件夹）→ 快照里 `errors` 加一条「未打开工作区」，其余返回空数组，不崩。

### `getSnapshot()` 返回（**这就是 webview 收到的全部数据**）

```js
{
  view: 'board' | 'list',          // 来自 workspaceState，默认 'board'
  stats: { projectCount, sessionCount, weekCount },
  pulse: [8 个数字],                // 最近 8 周每周提问数，见下
  projects: [{
    name, status,                  // status 可能是 null（未标注）
    docCount, ago,                 // ago 是预格式化的相对时间，如 '5 天前'
    summary, readmePath, path
  }],
  sessions: [{
    id, title, promptCount, ago, branch, empty
  }],
  claude: { installed: boolean },
  errors: [string]                 // 如 '会话目录不存在'
}
```

**`ago` 在扩展侧预格式化**（用 `lib/format.relativeTime`），webview 不碰时间计算。

### `pulse` 怎么算

会话按 `lastTs` 降序。取**最近 8 个自然周**（周一为一周之始，含本周），
统计每周内的**真实提问条数**。

⚠️ 不要用「把整个会话的提问数归到它 lastTs 那一周」这种近似 —— 一个会话可能横跨数周
（实测 `c7fd05f6` 从 7-18 持续到 9-06，34 条提问）。

所以：**`sessionScanner` 需要额外返回 `promptTimestamps: string[]`**
（每条真实提问的 ISO 时间戳）。这是 `src/lib/sessionScanner.js` 的小改动，允许你动它：
在 `isRealPrompt(record)` 为真时，把 `record.timestamp` push 进数组（没有 timestamp 就跳过）。

然后 store 把这些时间戳按自然周分桶。空周填 0 —— **空周必须保留**，那是真实信息。

---

## 4. `src/claude.js` —— ★ 最需要小心的文件

与已安装的 Claude Code 扩展（`anthropic.claude-code`）对接，实现「点会话就恢复它」。

**下面这些是从该扩展 `extension.js` 里逆向出来的事实，不是猜测。不要自己发明 API。**

扩展注册的命令（第一个参数就是 sessionId）：
```js
registerCommand("claude-vscode.editor.open", async (sessionId, initialPrompt, viewColumn,
                 newSessionGroupId, fullEditor, options) => { ... })
```

扩展注册的 URI handler（公开入口）：
```js
case "/open": { const s = params.get("session"), p = params.get("prompt");
                if (s !== undefined && !isValidId(s)) return;
                executeCommand("claude-vscode.primaryEditor.open", s, p); }
```
→ 深链形如 `vscode://anthropic.claude-code/open?session=<id>`

**用户已设 `claudeCode.preferredLocation: "panel"`**，所以走命令会让会话开在底部面板区。

### 要导出的东西

```js
const CLAUDE_EXT_ID = 'anthropic.claude-code';
const OPEN_CMD      = 'claude-vscode.editor.open';   // ← 命令名只写在这一处
const uriFor = (id) => `vscode://anthropic.claude-code/open?session=${encodeURIComponent(id)}`;

function isInstalled() { ... }
function getVersion() { ... }        // 读扩展的 package.json.version，写进日志便于排查
async function openSession(sessionId) { ... }   // 返回 { ok, via?, reason? }
```

`openSession` 三级降级，**每一步失败都要记日志**：

```
1. 未装扩展 → 返回 { ok:false, reason:'not-installed' }
    （UI 会把按钮改成「安装 Claude 扩展」）
2. 扩展装了但未激活 → await extension.activate()   // 冷启动时必须先激活
3. try  await vscode.commands.executeCommand(OPEN_CMD, sessionId)
        → { ok:true, via:'command' }
4. catch → try await vscode.env.openExternal(vscode.Uri.parse(uriFor(sessionId)))
        → { ok:true, via:'uri' }
5. 都失败 → 记日志，返回 { ok:false, reason:'failed' }
```

**为什么命令优先、深链兜底**：命令不经过外部协议处理，不会弹确认框；
且它能尊重用户已设的 preferredLocation。深链是公开契约，作为命令改名后的活路。

**把命令名和扩展 ID 集中成顶部常量**，并在文件头写一行中文注释说明：
「本集成基于 anthropic.claude-code 2.1.281 逆向。若将来失效，改这里的常量。」

---

## 5. `src/watcher.js`

导出 `startWatching(store, isVisible)` 返回 `vscode.Disposable`。

监听两处：
```js
vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(sessionDirUri, '*.jsonl'))
vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectsDirUri, '*'))
```

**三个必须做的保护**（否则面板会卡）：
1. **去抖 ≥ 1500ms** —— 活跃会话的 jsonl 每秒都在追加，watcher 会疯狂触发
2. **只在面板可见时刷新** —— 不可见时只打脏标记，`onDidChangeVisibility` 时再补扫
3. **兜底轮询** —— `setInterval(30_000)`，且只在可见时跑。非工作区绝对路径的
   watcher 在 Windows 上历史上有不生效的情况

---

## 6. `src/panel.js`

导出 `class TaskboardViewProvider`，实现 `resolveWebviewView`。

要点（这些都已验证过，照做即可）：

- 注册时用 `{ webviewOptions: { retainContextWhenHidden: true } }`
- `webview.options = { enableScripts: true, localResourceRoots: [mediaRoot] }`
- 资源 URI **必须用** `vscode.Uri.joinPath(context.extensionUri, 'media', 'x.css')`
  再 `webview.asWebviewUri(...)`。**不要自己拼字符串**，路径里有中文用户名时手工拼会编码错
- **CSP**（`default-src 'none'` 是官方推荐的起点）：
  ```
  default-src 'none';
  img-src ${webview.cspSource} data:;
  style-src ${webview.cspSource} 'unsafe-inline';
  script-src 'nonce-${nonce}';
  font-src ${webview.cspSource};
  ```
  ⚠️ `style-src` **必须带 `'unsafe-inline'`** —— 行内 `style` 属性也受它管辖，
  而我们的入场错峰动画依赖 `style="--i:3"`。
  ⚠️ nonce 每次 `getHtml` 重新生成（32 位随机字母数字）。
- HTML 结构：加载 `media/style.css` 和 `media/main.js`（带 nonce），
  body 里只有一个 `<div id="root"></div>`。**面板内容全部由 `media/main.js` 渲染**，
  不要在 `getHtml` 里写业务 DOM。
- 消息协议（webview → 扩展）：

  | type | 载荷 | 动作 |
  |---|---|---|
  | `ready` | — | 回推快照 |
  | `refresh` | — | `store.refresh(true)` |
  | `setView` | `'board'\|'list'` | 写 `workspaceState` 并回推 |
  | `openSession` | `{ id }` | `claude.openSession(id)` |
  | `previewSession` | `{ id }` | 见下 |
  | `openProject` | `{ path, readmePath }` | 打开 README.md |
  | `openDocs` | `{ path }` | 在资源管理器中定位 |

- 扩展 → webview：`{ type:'state', payload: snapshot }` 和 `{ type:'toast', text, level }`

- `store.onDidChange` → `postMessage({type:'state', payload})`
- `view.onDidChangeVisibility` → 可见时 `store.refresh()`

### `previewSession` 的预览内容

**先只做到「够用」**：读该会话的 jsonl，取
- `firstPrompt`（首条真实提问）
- **最后 3 条 assistant 的文本**（每条截断 300 字）

通过 `{ type:'preview', payload:{ id, title, firstPrompt, lastReplies:[...], meta:{...} } }`
推给 webview。webview 侧用抽屉展示。

（`sessionScanner` 需要能按需读单个文件的尾部回复 —— 可以加一个
`readSessionPreview(filePath, { maxReplies: 3 })`，用流式读，只保留最后 3 条，
不要全文载入内存。）

---

## 7. `src/extension.js` —— 重写为装配

```js
async function activate(context) {
  const logger = require('./logger').init();
  context.subscriptions.push(logger);
  const store = new BoardStore(context);
  const provider = new TaskboardViewProvider(context, store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('taskboard.main', provider,
      { webviewOptions: { retainContextWhenHidden: true } })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('taskboard.refresh', () => store.refresh(true)),
    vscode.commands.registerCommand('taskboard.toggle', () => provider.toggleView())
  );
  store.refresh();                        // 后台预热，不 await 阻塞激活
}
```

命令 `taskboard.refresh` 和 `taskboard.toggle` 已在 `package.json` 里声明，**不要改 manifest**。

---

## 验收

1. `node --check` 每个新文件语法通过
2. `node --test test/*.test.js` 仍全绿
3. 写一个 `test/store-smoke.mjs`：不依赖 vscode，直接调 store 的**纯逻辑部分**
   （周分桶函数应当是纯函数、可单独导出并测试）—— 喂造的时间戳，断言分桶正确
4. 报告里明确列出：你**不确定**的地方、你**假设**了什么

有任何做不到或不确定的，**明说**，不要编造 API。
