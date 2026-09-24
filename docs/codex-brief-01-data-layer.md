# Codex 任务书 01 — 数据层

## 项目背景

这是给用户 `d:\Claude` 仓库做的 **VS Code 扩展**，名叫「任务面板」（`vscode-taskboard`）。
侧边栏面板，展示两样东西：

1. **他的项目** — 来自 `d:\Claude\KB\02-项目\`，5 个目录，状态编码在目录名后缀里
2. **他的 AI 会话** — 来自 `C:\Users\<用户>\.claude\projects\<工作区编码名>\*.jsonl`

扩展的 `media/style.css`、`src/extension.js`、`package.json` **已写好，不要改**。

## 硬性约束（违反会直接炸，不是风格问题）

1. **CommonJS，不是 ESM。** 本仓库其他项目写 `"type": "module"`，本项目**故意不写**——
   VS Code 扩展宿主里 ESM 会让 `require('vscode')` 报 `require is not defined`。
   所以：**一律用 `require()` / `module.exports`，禁止 `import` / `export`。**
2. **零构建步骤。** 没有 TypeScript、没有打包器。写 `.js` 直接跑。
3. **`src/lib/*.js` 里禁止 `require('vscode')`。** 这一层必须是纯 Node，
   这样 `node --test` 能直接跑单测。需要 vscode API 的东西放 `src/` 根层（本批不涉及）。
4. 代码注释用中文，和本仓库其他项目一致。
5. 依赖只用 Node 内置模块（`fs` / `path` / `os` / `readline` / `crypto`）。
   **不要引入任何第三方包。**

## 本批要产出的文件

```
src/lib/jsonl.js           单行解析 + 噪音判定
src/lib/sessionScanner.js  会话扫描器（流式）
src/lib/projectScanner.js  项目扫描器
src/lib/paths.js           路径推导
src/lib/format.js          格式化工具
test/fixtures/*.jsonl      测试固件
test/jsonl.test.js
test/sessionScanner.test.js
test/projectScanner.test.js
test/format.test.js
```

---

## 1. `src/lib/jsonl.js`

导出两个函数。

### `readUserContent(record) -> string`

`record.message.content` 有**两种形态，都必须处理**（实测：字符串 74 条 / 数组 2333 条）：

- 是 `string` → 直接返回
- 是 `Array` → 拼接所有 `{type:'text', text:'...'}` 元素的 `text`，忽略其他类型
  （数组里还会有 `tool_result`、`image` 等，跳过）
- 其他 → 返回 `''`

### `isRealPrompt(record) -> boolean`

判断一条 `type:'user'` 的记录是不是「用户真实提问」。**全部条件满足**才为 `true`：

1. `record.type === 'user'`
2. `record.isMeta !== true`（实测 2381 条 user 里有 59 条是 meta）
3. content 里**不含** `tool_result` 类型的块
   （实测：2155/2381 的 user 记录是工具返回值，不是提问）
4. `readUserContent(record).trim()` 非空
5. **开头不匹配任何噪音前缀**

噪音前缀清单（实测得来，用 `String.prototype.startsWith` 判断，
**不要用正则**——多层转义极易写错）：

```js
const NOISE_PREFIXES = [
  '<local-command-caveat>',
  '<command-name>',
  '<command-message>',
  '<command-args>',
  '<local-command-stdout>',
  '<\\system-reminder',
  '</system-reminder',
  '<bash-input>',
  '<bash-stdout>',
  '[Request interrupted',
  'Caveat:'
];
```

注意 `<\\system-reminder` 在 JS 字符串字面量里就是 `<` + `\` + `system-reminder`
（因为 jsonl 里存的是转义过的标签）。

---

## 2. `src/lib/sessionScanner.js`

### 导出 `scanSessionFile(filePath) -> Promise<SessionMeta>`

**必须**用 `fs.createReadStream` + `readline.createInterface` 流式逐行解析。
**禁止** `readFileSync` + `split('\n')`——最大单文件 24MB，会爆内存。

逐行 `JSON.parse`，**用 try/catch 包住，坏行跳过不中断整个文件**。

按 `record.type` 分派（实测该目录有 14 种 type，只处理下面 4 种，其余全部忽略）：

| type | 处理 |
|---|---|
| `ai-title` | 取 `record.aiTitle`（string）。**多条时取最后一条**（标题会随会话演化） |
| `custom-title` | 取 `record.customTitle`（string）。同样 last-wins |
| `assistant` | `assistantCount++`；若 `record.message.model` 存在，加进 `models` Set |
| `user` | `userCount++`；若 `isRealPrompt(record)` 则 `realPromptCount++`，且**仅第一次**记下 `readUserContent(record).trim().slice(0, 400)` 作为 `firstPrompt` |

**时间戳**：只有部分 type 带 `record.timestamp`（ISO 8601 UTC，形如
`2026-09-14T12:17:56.341Z`）。对**所有**带 timestamp 的行：
```js
if (typeof record.timestamp === 'string') {
  if (!minTs || record.timestamp < minTs) minTs = record.timestamp;
  if (!maxTs || record.timestamp > maxTs) maxTs = record.timestamp;
}
```
⚠️ **不要取第一行/最后一行的 timestamp。** 实测存在乱序条目
（如某文件 626 条里有 8 条乱序，来自 resume / 队列消息）。
用字符串比较即可——ISO 8601 UTC 字典序 == 时间序。

**标题三级回退**：
```js
title = aiTitle || customTitle
     || (firstPrompt ? firstPrompt.slice(0, 24) + (firstPrompt.length > 24 ? '…' : '') : '(空会话)');
titleSource = aiTitle ? 'ai' : customTitle ? 'custom' : firstPrompt ? 'prompt' : 'none';
```

**返回结构**：
```js
{
  id,                 // 文件名去掉 .jsonl，即 uuid
  file,               // 绝对路径
  size, mtimeMs,      // 来自 fs.stat
  title, titleSource, // 'ai' | 'custom' | 'prompt' | 'none'
  realPromptCount, userCount, assistantCount,
  firstPrompt,        // string，可能为 null
  firstTs, lastTs,    // ISO 字符串，可能为 null
  models,             // string[]
  gitBranch,          // 最后一条带 gitBranch 的记录里的值，可能为 null
  isEmpty             // realPromptCount === 0 && titleSource === 'none'
}
```

### 导出 `scanProjectDir(dirPath, opts) -> Promise<SessionMeta[]>`

扫 `dirPath` 下所有 `*.jsonl`。
**只处理文件，忽略同名 `<uuid>/` 子目录**（那些是 `subagents/` 和 `tool-results/`，
不是独立会话）。
返回按 `lastTs` **降序**排列的数组（`null` 排最后）。
`opts = { concurrency = 4 }` — 并发控制，不要一次性开 21 个文件流。

---

## 3. `src/lib/projectScanner.js`

### 导出 `scanProjects(dirPath) -> Promise<Project[]>`

扫 `dirPath` 下的**子目录**（`d:\Claude\KB\02-项目\`）。

⚠️ **根目录下的 `README.md` 是「这个目录放什么」的说明文档，不是项目。**
只处理 `isDirectory()` 的条目。

**状态解析**——状态编码在目录名后缀：
```
示例应用-规划中        → { name: '示例应用',   status: '规划中' }
示例工具-开发中                 → { name: '示例工具',            status: '开发中' }
示例项目-已完成           → { name: '示例项目',      status: '已完成' }
遗留系统-已归档   → { name: '遗留系统', status: '已归档' }
无状态目录                    → { name: '无状态目录',        status: null }
```

⚠️ **规范与实际不一致，必须容错**：`KB/02-项目/README.md` 里写的状态词表是
`规划中 / 开发中 / 已上线 / 已归档`，但实际用的是 **`已完成`**（不在词表里）。

所以合法状态集合 = `['规划中', '开发中', '已上线', '已完成', '已归档']`。
无后缀 → `status: null`（前端归入「未标注」桶，**不能丢弃**）。

正则建议：`/-([^-]+)$/`，取捕获组，若在合法集合里则切分。

**每个项目额外读取**：
- `docCount` — 该目录下所有文件数（递归）
- `mtimeMs` — 目录下最新文件的修改时间
- `summary` — 读 `README.md` 前 800 字节，取**第一个非空且不以 `#` 开头的行**，
  截断到 80 字符。没有 README 或没有这样的行 → `null`

**返回结构**：
```js
{
  name, status,        // status: string | null
  dirName,             // 原始目录名
  path,                // 绝对路径
  readmePath,          // README.md 绝对路径，不存在则 null
  docCount, mtimeMs, summary
}
```

---

## 4. `src/lib/paths.js`

### 导出 `claudeProjectsRoot() -> string`
返回 `path.join(os.homedir(), '.claude', 'projects')`

### 导出 `encodeWorkspaceKey(fsPath) -> string`
`fsPath.replace(/[\\/:.]/g, '-')`。例：`d:\Claude` → `d--Claude`。
**仅作「猜测」用，不是可靠契约**（见下）。

### 导出 `findSessionDirFor(workspacePath, rootDir) -> Promise<string|null>`

⚠️ **这是本文件最重要的函数，不要简化成「猜编码」。**

实测规则 `d:\Claude` → `d--Claude` 能对上，但那是**观察到的现象，不是契约**，
Claude Code 升级可能改。所以：

1. 先跑快速路径：用 `encodeWorkspaceKey` 猜一个目录名，若存在**且**其中至少一个
   `.jsonl` 的 `cwd` 字段（大小写不敏感、正反斜杠归一化后）等于 `workspacePath`
   → 直接返回
2. 猜错则**遍历 `rootDir` 下所有子目录**：每个目录读**第一个 `.jsonl` 的前 200 行**，
   找第一条带 `cwd` 字段的记录，比对。命中即返回。
3. 都没命中 → 返回 `null`

（实测 `.jsonl` 里的 `user` / `assistant` 记录都带 `cwd`，如 `"d:\\Claude"`。
比对时统一小写并统一斜杠方向。）

### 导出 `normalizePath(p) -> string`
小写、`\` → `/`、去掉尾部斜杠。供上面比对用。

---

## 5. `src/lib/format.js`

纯函数，导出：

- `relativeTime(isoString, now = Date.now()) -> string`
  返回中文相对时间：`刚刚` / `N 分钟前` / `N 小时前` / `昨天` /
  `N 天前` / `M-D`（超过 30 天）
- `absoluteTime(isoString) -> string` — `M-D HH:mm` 格式（本地时区）
- `formatSize(bytes) -> string` — `1.2 MB` / `340 KB` / `900 B`
- `truncate(str, max) -> string` — 超长加 `…`

⚠️ 时间戳是 **UTC**（带 `Z`），显示要转**本地时区**（用户在东八区）。
用 `new Date(isoString)` 拿本地时间，不要手工 +8。

---

## 6. 测试

### `test/fixtures/` 下手工构造这些 jsonl（每行一个 JSON 对象）

| 文件 | 覆盖点 |
|---|---|
| `normal.jsonl` | 多条 `ai-title`（断言取最后一条）+ 真实提问 + tool_result + 乱序 timestamp |
| `custom-title.jsonl` | 只有 `custom-title`，无 `ai-title` |
| `prompt-fallback.jsonl` | 无任何 title 类型，断言回退到首条真实提问 |
| `empty.jsonl` | 只有 `mode` / `queue-operation`，断言 `isEmpty === true` |
| `noise.jsonl` | 10 种噪音前缀全覆盖，断言 `realPromptCount === 0` |
| `string-content.jsonl` | `message.content` 是**字符串**而非数组的 user 记录 |
| `out-of-order.jsonl` | timestamp 首行最大、末行最小，断言 min/max 取的是排序后结果 |

### `test/*.test.js` — 用 Node 内置测试框架

```js
const { test } = require('node:test');
const assert = require('node:assert');
```

**不要引第三方测试框架。** 跑法：`node --test test/`

必须断言的（这些是逆向验证过的真值，写死进测试）：

- `normal.jsonl` 的 `title` 等于**最后**一条 `ai-title` 的值
- `out-of-order.jsonl` 的 `firstTs` < `lastTs`（即使首行时间戳更大）
- `noise.jsonl` 的 `realPromptCount === 0` 且 `isEmpty === true`
- `string-content.jsonl` 能正确提取出提问文本
- `format.relativeTime` 边界：59 秒 → `刚刚`，90 秒 → `1 分钟前`，
  25 小时 → `昨天`，40 天 → `M-D` 格式
- `projectScanner` 对 `无状态目录` 这类无后缀名字返回 `status: null`
- `projectScanner` 对 `示例项目-已完成` 返回 `status: '已完成'`（**不是**规范里的 `已上线`）

---

## 完成后

跑 `node --test test/` 必须全绿。把结果贴出来。
如果有任何一条你做不到或不确定，**明说**，不要编造。
