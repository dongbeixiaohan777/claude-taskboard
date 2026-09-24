# Codex 任务书 02 — 修正提问计数（真机数据验证发现的缺陷）

## 背景

任务书 01 你实现的 `src/lib/*` 结构正确、10 个测试全绿。
但我把它**接到真实数据上跑**（`C:\Users\东北小汉\.claude\projects\d--Claude\`，21 个 jsonl），
发现**提问总数比真值多 9 条**。

根因：**任务书 01 里我给的噪音前缀清单本身是错的**（漏了 `<task-notification>`）。
你的测试固件是照那份错误清单写的，所以测试全绿但行为是错的。
这不是你的问题，是我给的规格不全。现在修正。

## 实测证据（真实数据普查结果）

过滤掉 `isMeta:true` 和 `tool_result` 之后，user 记录文本开头的形态分布：

| 开头形态 | 条数 | 应该怎么处理 |
|---|---|---|
| 正常文本 | 139 | 算提问 |
| `<task-notification>` | 9 | **整条排除** |
| `<command-name>` | 8 | 整条排除（已在清单里） |
| `<local-command-stdout>` | 6 | 整条排除（已在清单里） |
| `<ide_opened_file>` | 3 | **剥掉标签，保留后面的正文** |
| `<command-message>` | 2 | 整条排除（已在清单里） |

**正确总数 = 139 + 3 = 142。** 你现在的实现是 151（多了 9 条 `<task-notification>`）。

逐会话差异（你的实现 vs 正确值）：
```
0a3d4003  15 → 9    （多 6）
97b0d406   4 → 2    （多 2）
ee26915b   3 → 2    （多 1）
其余 18 个会话完全一致
```

### `<ide_opened_file>` 是个陷阱 —— 不能整条丢

真实样本（注意标签**后面跟着用户的真实提问**）：
```
<ide_opened_file>The user opened the file d:\Claude\CLAUDE.md in the IDE.
This may or may not be related to the current task.</ide_opened_file>开工
```
这里 `开工` 是用户真实提问。**整条排除会丢掉真实提问**，正确做法是剥掉标签块、保留正文。

（另有 14 条 `<ide_opened_file>` 剥完是空的 —— 那些确实不是提问。所以判断依据是**剥离后的剩余文本是否为空**，不是标签本身。）

### 已确认【不需要】处理的（别浪费精力）

- `[Image: original 1920x3412, ...]` —— 36 条，**全部 `isMeta: true`**，现有 `isMeta` 检查已经拦住
- `<\system-reminder` —— 实际数据里**出现 0 次**（我上一份规格给错了，保留它无害，但别指望它有用）
- `[Request interrupted` / `Caveat:` —— 实际数据里 0 次（保留作防御）
- `.jsonl` 里 `origin.kind === 'human'` 的记录共 144 条，其中 2 条是**斜杠命令调用**（`/money`、`/research-deliverable`）。**斜杠命令不算提问** —— 用户在同一条会话里还发了真实需求，都算进去会重复计数。所以 144 - 2 = 142 才是一致的口径。

---

## 要改的东西

### 1. `src/lib/jsonl.js` — 修正 `isRealPrompt`

改成两阶段判定：

```js
// 阶段一：这些开头【整条排除】，无论后面还有什么
const EXCLUDE_PREFIXES = [
  '<task-notification>',      // ← 新增。系统生成的后台任务通知
  '<command-name>',
  '<command-message>',
  '<command-args>',
  '<local-command-caveat>',
  '<local-command-stdout>',
  '<bash-input>',
  '<bash-stdout>',
  '<\\system-reminder',       // 防御性保留
  '</system-reminder',
  '[Request interrupted',
  'Caveat:',
  '[Image:'                   // 防御性：实测全被 isMeta 拦住，留着以防其它工作区
];

// 阶段二：其它开头的 <tag>...</tag> 块【剥掉但保留正文】（如 <ide_opened_file>）
function stripLeadingTagBlocks(text) {
  let s = text;
  for (let i = 0; i < 5; i++) {
    const m = s.match(/^<([a-zA-Z_][\w-]*)>[\s\S]*?<\/\1>\s*/);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  return s.trim();
}
```

判定顺序：
1. `record.type !== 'user'` → false
2. `record.isMeta === true` → false
3. content 含 `tool_result` → false
4. `raw = readUserContent(record).trim()`；空 → false
5. `raw` 以任一 `EXCLUDE_PREFIXES` 开头 → false
6. `stripped = stripLeadingTagBlocks(raw)`；空 → false
7. 否则 **true**

**同时导出 `readPromptText(record)`** —— 返回第 6 步的 `stripped` 结果。
`sessionScanner.js` 记录 `firstPrompt` 时必须用它，**不能用原始文本** ——
否则首条提问带 `<ide_opened_file>...` 前缀时，标题会被污染成
`<ide_opened_file>The user opened the file...`。

注意用 `startsWith` 判断，不要用正则（转义坑）。阶段二的正则里
`<\/\1>` 用反向引用确保闭合标签与开标签同名。

### 2. `src/lib/jsonl.js` — `readUserContent` 的小修

多个 text 块拼接目前用 `join('')`，会把相邻块粘成一个词。改成 `join('\n')`。

### 3. `src/lib/sessionScanner.js`

把 `firstPrompt` 的赋值改为用 `readPromptText(record)`。

### 4. 新增测试固件（放在 `test/fixtures/`）

**`task-notification.jsonl`** —— 断言 `realPromptCount === 1`（不是 2）、`isEmpty === false`
```
{"type":"user","message":{"content":"<task-notification>\n<task-id>abc</task-id>\n<tool-use-id>call_00_x</tool-use-id>\n<output-file>C:\\tmp\\a.txt</output-file>\n</task-notification>"},"timestamp":"2026-09-14T10:00:00.000Z"}
{"type":"user","message":{"content":"帮我看看这个面板"},"timestamp":"2026-09-14T10:01:00.000Z"}
```

**`tag-prefixed.jsonl`** —— 断言 `realPromptCount === 1` **且 `firstPrompt === '开工'`**（标签必须被剥掉）
```
{"type":"user","message":{"content":"<ide_opened_file>The user opened the file d:\\Claude\\CLAUDE.md in the IDE. This may or may not be related to the current task.</ide_opened_file>开工"},"timestamp":"2026-09-14T10:00:00.000Z"}
```

**`tag-empty.jsonl`** —— 断言 `realPromptCount === 0`
```
{"type":"user","message":{"content":"<ide_opened_file>The user opened the file a.md in the IDE.</ide_opened_file>"},"timestamp":"2026-09-14T10:00:00.000Z"}
```

**`slash-command.jsonl`** —— 断言 `realPromptCount === 1`（斜杠命令那条不算）
```
{"type":"user","message":{"content":"<command-message>money</command-message>\n<command-name>/money</command-name>\n<command-args></command-args>"},"timestamp":"2026-09-14T10:00:00.000Z"}
{"type":"user","message":{"content":"换日知录做一遍。"},"timestamp":"2026-09-14T10:01:00.000Z"}
```

### 5. 新增 `test/smoke.mjs` —— 真机冒烟（可选跑，只读）

对 `~/.claude/projects/d--Claude/` 全量扫一遍，打印表格：
`id 前 8 位 | 提问数 | 标题 | 首末时间`，末尾打印合计。

**注意**：合计值会随时间变化（该目录里有一个正在进行的会话在不断追加），
**不要把 142 写死进断言**。这个脚本是给人看的核对工具，不是测试。

---

## 验收标准

1. `node --test test/*.test.js` 全绿（含 4 个新固件）
2. 跑 `node test/smoke.mjs`，**算术自检必须成立**：
   `sum(realPromptCount) === sum(origin.kind==='human') - 斜杠命令条数`
   你可以在 smoke 里顺带统计 `origin.kind === 'human'` 并打印两者之差，
   **差值应当是 0 到 2 之间**（斜杠命令是变化的）
3. 抽查这几个已知会话，提问数必须是：
   `c7fd05f6 = 34` · `13fc57d1 = 30` · `2aede496 = 26` · `0a3d4003 = 9` · `30feb263 = 11`
   （前三个很大，是最容易暴露计数错误的）

如果任何一条你做不到或有疑问，**明说**，不要编造或糊弄过去。
