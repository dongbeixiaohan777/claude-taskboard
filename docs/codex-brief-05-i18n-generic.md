# Codex 任务书 05 — 国际化 + 通用化

## 背景

`vscode-taskboard` 目前是**为作者自己的机器定制的**（中文界面、写死 `KB/02-项目` 目录、
只认中文状态词）。要发布到 VS Code 市场给任何人用，需要：

1. **英文界面**（市场主要受众是英文用户），中文作为备选
2. **不写死个人目录约定** —— 别人没有 `KB/02-项目`
3. **状态词支持中英双语**

## 硬性约束（不变）

1. **CommonJS**（扩展侧）。`src/lib/*` **禁止 `require('vscode')`** —— 保持可单测。
2. webview 侧（`media/*.js`）是浏览器环境，**禁止 `require`**，只用 `window`/`document`。
3. 零第三方依赖。
4. 中文注释。
5. **不要改 `media/style.css` 和 `media/glass.css`** —— 视觉已定稿。
6. `node --test test/*.test.js` 必须保持全绿（现有 26 个）。

---

## 一、`src/i18n.js`（新建，纯 Node）

不能 `require('vscode')`。locale 由外部注入。

```js
'use strict';
let locale = 'en';

/** @param {string} raw 形如 'zh-cn' / 'en' / 'zh-tw' */
function setLocale(raw) {
  const v = String(raw || '').toLowerCase();
  locale = v.startsWith('zh') ? 'zh-cn' : 'en';
}

function getLocale() { return locale; }

/** @param {string} key @param {...(string|number)} args 替换 {0} {1}… */
function t(key, ...args) { ... }

module.exports = { setLocale, getLocale, t, STRINGS };
```

导出 `STRINGS` 便于单测断言「两种语言的键集合一致」。

### 键表（必须两种语言都有全部键）

**格式**：`'en': {...}` 和 `'zh-cn': {...}`，键完全相同。

| 键 | en | zh-cn |
|---|---|---|
| `time.justNow` | `just now` | `刚刚` |
| `time.minutesAgo` | `{0} min ago` | `{0} 分钟前` |
| `time.hoursAgo` | `{0} h ago` | `{0} 小时前` |
| `time.yesterday` | `yesterday` | `昨天` |
| `time.daysAgo` | `{0} d ago` | `{0} 天前` |
| `status.plan` | `Planning` | `规划中` |
| `status.dev` | `In progress` | `开发中` |
| `status.live` | `Shipped` | `已完成` |
| `status.arch` | `Archived` | `已归档` |
| `status.none` | `Unlabeled` | `未标注` |
| `notice.sessionDirMissing` | `Claude session folder not found.` | `会话目录不存在` |
| `notice.projectsDirMissing` | `Project folder not found.` | `项目目录不存在` |
| `notice.noWorkspace` | `No folder is open.` | `未打开工作区` |
| `notice.readSessionsFailed` | `Some sessions could not be read.` | `部分会话读取失败` |
| `notice.scanSessionsFailed` | `Could not read the session folder.` | `无法读取会话目录` |
| `notice.scanProjectsFailed` | `Could not read the project folder.` | `无法读取项目目录` |
| `notice.cacheWriteFailed` | `Could not write the cache.` | `缓存写入失败` |
| `notice.locateSessionFailed` | `Could not locate the session folder.` | `无法定位会话目录` |
| `toast.genericError` | `That did not work. Please try again.` | `操作没有完成，请稍后重试。` |
| `toast.claudeNotInstalled` | `Claude Code extension not found. Opening the extension page.` | `尚未安装 Claude Code 扩展，正在打开扩展页面。` |
| `toast.claudeOpenFailed` | `Claude Code could not open that session.` | `Claude Code 暂时无法打开这个会话。` |
| `toast.sessionNotFound` | `Session not found. Try refreshing.` | `找不到这个会话，请刷新后重试。` |
| `toast.previewFailed` | `Could not read the session preview.` | `暂时无法读取会话预览。` |
| `toast.noReadme` | `This project has no README.md to open.` | `这个项目还没有可打开的 README.md。` |
| `toast.revealFailed` | `Could not reveal that folder in the explorer.` | `暂时无法在资源管理器中定位这个目录。` |

### 接法

- `src/extension.js` 的 `activate` 里：`i18n.setLocale(vscode.env.language)`
- `src/lib/format.js` 的 `relativeTime` 改用 `require('../i18n').t(...)`
  （注意相对路径是 `../i18n`，因为 format.js 在 `src/lib/`）
- `src/panel.js` 里 7 处 `this.toast('中文', level)` 改成 `this.toast(i18n.t('toast.xxx'), level)`
- `src/store.js` 里 `errors.push('中文')` 改成 `errors.push(i18n.t('notice.xxx'))`

---

## 二、`media/i18n.js`（新建，浏览器环境）

webview 侧的键表。**不能 require 任何东西**，挂到 `window`。

```js
(function () {
  'use strict';
  var STRINGS = { 'en': {...}, 'zh-cn': {...} };
  var locale = 'en';
  window.initI18n = function (raw) {
    locale = String(raw || '').toLowerCase().indexOf('zh') === 0 ? 'zh-cn' : 'en';
  };
  /** 替换 {0} {1}… */
  window.T = function (key) {
    var args = Array.prototype.slice.call(arguments, 1);
    var s = (STRINGS[locale] && STRINGS[locale][key]) || (STRINGS.en[key]) || key;
    return s.replace(/\{(\d+)\}/g, function (m, i) { return args[+i] !== undefined ? args[+i] : m; });
  };
  window.I18N_KEYS = ...;   // 便于沙盘自检
})();
```

### 键表（webview 专用）

| 键 | en | zh-cn |
|---|---|---|
| `panel.title` | `Taskboard` | `任务面板` |
| `stat.projects` | `Projects` | `项目` |
| `stat.sessions` | `Sessions` | `会话` |
| `stat.week` | `This week` | `本周` |
| `section.projects` | `Projects` | `项目` |
| `section.sessions` | `Sessions` | `会话` |
| `unit.docs` | `{0} docs` | `{0} 份文档` |
| `unit.docsShort` | `{0} docs` | `{0} 份` |
| `unit.prompts` | `{0} prompts` | `{0} 次提问` |
| `view.board` | `Board` | `看板` |
| `view.list` | `List` | `列表` |
| `empty.projects.title` | `No projects` | `暂无项目` |
| `empty.projects.desc` | `Set taskboard.projectsDir, or add project folders to your workspace.` | `检查项目目录设置，或在项目目录中添加项目文件夹。` |
| `empty.sessions.title` | `No sessions` | `暂无会话` |
| `empty.sessions.desc` | `Start a conversation in Claude Code and it will show up here.` | `打开 Claude Code 并开始对话后，会话会出现在这里。` |
| `session.untitled` | `(empty session)` | `(空会话)` |
| `pulse.aria` | `Prompts in the last 8 weeks` | `最近八周提问数` |
| `pulse.axis.older` | `8 weeks ago` | `8 周前` |
| `pulse.axis.label` | `prompts / week` | `每周提问数` |
| `pulse.axis.now` | `This week` | `本周` |
| `pulse.tip` | `{0} prompts` | `{0} 次提问` |
| `pulse.weekAria` | `Week {0}: {1} prompts` | `第 {0} 周：{1} 次提问` |
| `action.docs` | `Open project docs` | `打开项目文档` |
| `action.openInClaude` | `Open in Claude` | `在 Claude 中打开` |
| `action.preview` | `Preview` | `预览` |
| `action.close` | `Close` | `关闭` |
| `drawer.aria` | `Session preview` | `会话预览` |
| `notice.noClaude` | `Claude Code extension not found — preview works, but sessions cannot be reopened.` | `未检测到 Claude Code 扩展，只能预览、无法恢复会话。` |
| `drawer.noPrompt` | `No user prompt to show.` | `没有可显示的真实提问。` |
| `drawer.noReplies` | `No assistant replies to show.` | `没有可显示的助手回复。` |
| `notice.dismiss` | `Dismiss` | `关闭提示` |

### 接法

- `media/views.js` 和 `media/main.js` 里**所有中文界面文案**改为 `T('key')` 或 `T('key', n)`
- `src/panel.js` 的 `getHtml` 里，在加载 `views.js` **之前**插入
  `<script nonce="...">window.__LOCALE__=${JSON.stringify(locale)}</script>`
  → 注意 CSP 是 `script-src 'nonce-...'`，这段内联脚本**必须带同一个 nonce**
- `media/main.js` 顶层调 `window.initI18n(window.__LOCALE__)`

⚠️ `media/i18n.js` 必须在 `views.js` 之前加载（`views.js` 里可能会在定义时用到 T）。
如果 `views.js` 只在函数体内用 `T()`，则加载顺序无所谓，但**保险起见放前面**。
`src/panel.js` 的 `getHtml` 里加上这个 `<script>` 标签和 `asWebviewUri`。

---

## 三、通用化：`src/lib/paths.js` 的 `resolveProjectsDir`

现在的实现写死了作者的目录约定：

```js
function resolveProjectsDir(workspaceRoot, configured) {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (value) return value;
  if (!workspaceRoot) return null;
  return path.join(workspaceRoot, 'KB', '02-项目');   // ← 只认作者自己的约定
}
```

**改成按候选列表自动探测**（返回**第一个存在的目录**）：

```js
const PROJECT_DIR_CANDIDATES = [
  ['KB', '02-项目'],      // 作者约定，保留
  ['projects'],
  ['docs', 'projects'],
  ['taskboard'],
  ['.taskboard', 'projects']
];
```

新签名（**改成 async**，因为要 `fs.access` 探测）：

```js
/**
 * @param {string | undefined} workspaceRoot
 * @param {unknown} configured 设置项原值；非空则直接采用，不做探测
 * @returns {Promise<string | null>}
 */
async function resolveProjectsDir(workspaceRoot, configured) { ... }
```

- 配置了 → 直接用（**不校验存在性**，让 store 的 `fs.access` 去报错，保持现有错误提示）
- 没配置 → 按候选列表逐个 `fs.access`，返回第一个存在的
- 都不存在 → 返回 `null`（store 会走「项目目录不存在」分支，界面显示空状态）

⚠️ `src/store.js` 和 `src/watcher.js` 都调用了它，**两处都要改成 `await`**。

⚠️ `test/paths.test.js` 里有 8 个针对旧同步版本的断言。
**改成适配新签名**，并补两个用例：
- 「没有 KB/02-项目 但有 projects 目录时，返回 projects」
- 「候选都不存在时返回 null」
（用 `node:fs` 创建临时目录来测，测试完清理）

---

## 四、通用化：状态词支持中英双语

`src/lib/projectScanner.js` 现在只认 5 个中文词：

```js
const PROJECT_STATUSES = new Set(['规划中', '开发中', '已上线', '已完成', '已归档']);
```

**改成「词 → 规范键」的映射**，输出**规范键**而不是原始词：

```js
// 目录名后缀 → 规范状态键
const STATUS_ALIASES = {
  '规划中': 'plan', 'planning': 'plan', 'plan': 'plan',
  '开发中': 'dev',  'active': 'dev', 'in-progress': 'dev', 'wip': 'dev', 'inprogress': 'dev',
  '已上线': 'live', '已完成': 'live', 'done': 'live', 'shipped': 'live', 'complete': 'live', 'completed': 'live',
  '已归档': 'arch', 'archived': 'arch', 'archive': 'arch'
};
```

匹配时**大小写不敏感**（`Active` / `ACTIVE` 都认）。

`scanProjects` 返回的 `status` 字段变成 **`'plan' | 'dev' | 'live' | 'arch' | null`**。

⚠️ **这会波及 `media/views.js` 的 `STATUS_META`** —— 现在是：
```js
var STATUS_META = {
  '规划中': { css: 'var(--st-plan)', order: 0 },
  ...
};
```
改成按规范键：
```js
var STATUS_META = {
  plan: { css: 'var(--st-plan)', order: 0 },
  dev:  { css: 'var(--st-dev)',  order: 1 },
  live: { css: 'var(--st-live)', order: 2 },
  arch: { css: 'var(--st-arch)', order: 3 }
};
var STATUS_NONE = { css: 'var(--st-none)', order: 4 };
```
label 用 `T('status.plan')` 等；`null` 用 `T('status.none')`。

⚠️ `media/main.js` 里也有 `name.textContent = status || '未标注'` 之类的地方，一并改。

⚠️ `test/projectScanner.test.js` 里的断言会失败（原来断言 `status === '已完成'`）。
改成断言规范键 `'live'`，并**新增两个用例**：
- `MyApp-Planning` → `status === 'plan'`（英文词）
- `MyApp-DONE` → `status === 'live'`（大小写不敏感）

---

## 五、`package.json` 元数据（给市场用）

改这些字段（**其余不要动**）：

```jsonc
{
  "name": "claude-taskboard",
  "displayName": "Claude Taskboard",
  "description": "A sidebar panel for your projects and Claude Code sessions: see what's alive, where your time went, and jump back to any past conversation.",
  "version": "0.1.0",
  "publisher": "dongbeixiaohan777",
  "license": "MIT",
  "private": false,
  "icon": "media/icon-128.png",
  "categories": ["Other", "Visualization"],
  "keywords": ["claude", "claude-code", "taskboard", "sessions", "projects", "dashboard", "kanban"],
  "repository": {
    "type": "git",
    "url": "https://github.com/dongbeixiaohan777/claude-taskboard.git"
  },
  "bugs": { "url": "https://github.com/dongbeixiaohan777/claude-taskboard/issues" },
  "engines": { "vscode": "^1.85.0" }
}
```

⚠️ `name` 从 `vscode-taskboard` 改为 `claude-taskboard` —— **但同时要改**：
- `activationEvents` / `menus` 里的 `view == taskboard.main` —— **不用改**（那是视图 id，与 name 无关）
- 目录名保持 `vscode-taskboard` 不变（改目录会破坏已有的 junction）

⚠️ 配置项 `taskboard.projectsDir` 的 `markdownDescription` 要**改成英文**（市场是英文受众），
并更新说明：留空则自动探测 `KB/02-项目` / `projects` / `docs/projects` 等常见位置。

⚠️ `taskboard.glassEffect` 的 `enumDescriptions` 也改英文。

---

## 验收

1. `node --test test/*.test.js` 全绿（应 ≥ 30 个）
2. 起静态服务打开 `dev/preview.html`：
   - 默认（无 `__LOCALE__`）显示**英文**
   - 在控制台执行 `initI18n('zh-cn'); document.getElementById('app').innerHTML = renderApp(DATA,'board')` 后显示**中文**
   - 两种语言各截一张图
3. 报告里明确列出：**你假设了什么**、**哪里不确定**

有做不到或不确定的，**明说**。
