# Codex 任务书 04 — Webview 界面接线

## 背景

VS Code 扩展「任务面板」。数据层（`src/lib/*`）和扩展外壳（`src/*.js`）已完成。

**`media/style.css` 已完成并经过明暗双主题验证 —— 不要改它。**
本任务只做两件事：把渲染逻辑落到 `media/views.js`，把交互接到 `media/main.js`。

## ⚠️ 先读这一段：现有 `media/main.js` 必须整体替换

`media/main.js` 里已经有一份实现（另一个任务顺手写的）。它**逻辑能用，但视觉设计与本项目的设计规格冲突**，具体偏差：

| 设计规格要求 | 现有实现的问题 |
|---|---|
| 卡片左侧 3px **状态脊**，颜色按状态映射（`--st` 自定义属性） | **没设 `--st`** → `.card::after` 全部回落到灰色，整套状态配色丢失 |
| 泳道圆点按状态着色（`--lane-c`） | **没设** → 全灰 |
| 时间线节点**大小编码提问数**（`--node`） | **没设** → 所有节点一样大，信息丢失 |
| `.card__btn` 是 **20×20 的 SVG 图标位** | 塞的是**文字**（"README" / "目录" / "恢复"），会被 20px 的框裁掉 |
| 状态用**颜色**表达 | 把状态当**文字**塞进元信息行 |
| 视图切换在**项目区块头** | 放在了顶栏 |
| 增量更新，不重建 DOM | 每次 `root.innerHTML = ...` 全量重建 → **入场动画反复重播** |
| — | 用了 `.toolbar-btn` / `.toast` 两个 **CSS 里不存在的类** |

**要求：删掉现有 `media/main.js` 的实现，按下面的规格重写。**
保留它写对的部分：消息协议的名字、`escapeHtml`、`data-action` 事件委托的骨架、空状态文案。

**唯一的设计依据是 `dev/preview-render.js`** —— 那份代码的 DOM 结构已经过视觉验证，
`media/style.css` 就是按它写的。你的任务是把它的结构搬过去并接上交互，**不要自己重新设计 DOM**。

---

## 硬性约束

1. `media/*.js` 跑在 webview 里，是**浏览器环境**，不是 Node。
   **禁止 `require`**，不要用 `fs`/`path`。只有 `window`/`document`。
2. **不用任何框架、不引任何 CDN。** 纯 DOM API。
3. **不要改 `media/style.css`。** 你的 DOM 必须去适配已有的 class 名。
4. 中文注释。

---

## 现成资产（★ 先读这些）

### A. `dev/preview-render.js` —— 渲染逻辑的**原型**

里面已经有完整可用的渲染函数（在浏览器里跑通并截图验证过）：
`renderTopbar` / `renderStats` / `renderSeg` / `renderProjectCard` / `renderBoard` /
`renderProjectList` / `renderPulse` / `renderSessions` / `renderApp`

**你的任务是把它搬到 `media/views.js`**，并做三处修改（见下）。
函数命名和 DOM 结构**尽量照搬** —— CSS 是按那套 class 写的。

### B. `dev/preview.html` + `dev/preview-data.js` —— 可跑的设计沙盘

本地起个静态服务打开 `dev/preview.html` 就能看到成品长什么样。
**`dev/preview-data.js` 里的 `DATA` 就是快照的形状**，但注意真实快照的字段有差异（见下）。

### C. 真实快照形状（扩展推送给 webview 的 `payload`）

```js
{
  view: 'board' | 'list',
  stats: { projectCount, sessionCount, weekCount },
  pulse: [8 个数字],                        // 最近 8 周每周提问数
  projects: [{ name, status, docCount, ago, summary, readmePath, path }],
  sessions: [{ id, title, promptCount, ago, branch, empty }],
  claude:   { installed: boolean },
  glass:    'auto' | 'on' | 'off',
  errors:   [string]
}
```

⚠️ 与原型的差异：`ago`（如 `'5 天前'`）和 `summary` **由扩展侧预格式化好**，
webview **不要**做时间计算、不要做字符串截断。
`status` 可能是 `null`（未标注）。
`summary` 可能是 `null`（该项目没有 README）。

---

## 1. `media/views.js`

从 `dev/preview-render.js` 搬运，做这三处修改：

### 改动 1：`renderProjectCard` 增加操作按钮

现在只有「打开文档」一个按钮。需要两个，且**只在 `claude.installed` 为真时才显示恢复按钮**：

```html
<div class="card__act">
  <button class="card__btn" data-act="session" title="恢复上次会话">  <!-- 暂不做，先不做这个 -->
  <button class="card__btn" data-act="docs"    title="打开项目文档">{open 图标}</button>
</div>
```

项目卡片只保留 `docs` 一个按钮（恢复会话是会话卡片的功能）。

### 改动 2：会话时间线要能点，并加两个 hover 按钮

`renderSessions` 产出的 `.tl__i` 已经带 `data-id`。给它加操作按钮：

```html
<div class="tl__i" data-id="..." style="--st:...;--node:...">
  <div class="tl__t">标题</div>
  <div class="tl__m">...</div>
  <div class="card__act">
    <button class="card__btn" data-act="preview" title="预览">{eye 图标}</button>
    <button class="card__btn" data-act="open"    title="在 Claude 中打开">{chat 图标}</button>
  </div>
</div>
```

**hover 显隐不用你操心** —— `media/style.css` 里已经有
`.tl__i:hover .card__act { opacity: 1 }` 规则（我刚加的）。
`.tl__i` 本身是 `position: relative`，`.card__act` 是绝对定位，能正确落位。
你只要把 DOM 结构写对即可，**不要加任何内联 style 来控制显隐**。

`data-act="open"` 这个按钮**只在快照里 `claude.installed === true` 时才渲染**。

### 改动 3：`renderApp` 增加错误提示条与「未装 Claude」提示

```js
if (d.errors && d.errors.length) → 面板顶部插入
  '<div class="notice">' + errors.join(' · ') + '</div>'

if (d.claude && d.claude.installed === false) → 会话区上方插入
  '<div class="notice">未检测到 Claude Code 扩展，只能预览、无法恢复会话。</div>'
```

`.notice` 的样式已在 CSS 里。

**导出方式**：`window.renderApp = renderApp;`（不要用 ES module，webview 里用普通 script 标签加载）

---

## 2. `media/main.js` —— 交互与消息

替换现有的占位实现。

### 2.1 初始化

```js
const vscode = acquireVsCodeApi();   // 顶层调用一次，只能调一次
let state = null;                    // 当前快照
let everRendered = false;            // 用于区分「首次加载」和「增量更新」
```

启动时 `vscode.postMessage({ type:'ready' })`。

### 2.2 渲染 —— ★ 必须做 key 复用，不要 `innerHTML` 重建

**这是本任务最容易踩的坑**：文件监听每 1.5 秒可能推一次新快照。
如果每次都 `root.innerHTML = renderApp(...)`，**入场动画会反复重播**，看起来像面板在抽搐。

正确做法：
- **首次渲染**：`root.innerHTML = renderApp(state, state.view)`，动画正常播
- **后续更新**：只更新**变化的节点**
  - 用 `data-id` 建立 `Map<id, HTMLElement>`
  - 对比新旧数据：id 集合相同 → 只更新该节点的文本内容和 `style` 上的 `--st` /
    `--node`，**不重建 DOM、不重播动画**
  - id 集合变化（新增/删除）→ 才做局部增删
  - `stats` / `pulse` 直接更新文本与 `--h` 值即可

如果你觉得完整 diff 太复杂，**最低要求**：
首次之后的所有更新，一律**只更新已存在节点的 textContent / style 自定义属性**，
不再调用 `renderApp`。新增的会话条目单独 `insertAdjacentHTML` 插到顶部。

### 2.3 事件委托

在 `root` 上挂一个 `click` 监听，不要给每个按钮单独绑：

```js
root.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (btn) { ... 处理按钮 ... ; e.stopPropagation(); return; }
  const card = e.target.closest('.card[data-id]');
  if (card) { ... 项目卡片 → openProject ... }
  const tl = e.target.closest('.tl__i[data-id]');
  if (tl) { ... 会话条目 → previewSession ... }
});
```

动作 → 消息：

| 元素 | 动作 | 发什么 |
|---|---|---|
| 项目卡片本体 | 打开 README | `{type:'openProject', path, readmePath}` |
| 项目卡片 `data-act="docs"` | 在资源管理器定位 | `{type:'openDocs', path}` |
| 会话条目本体 | 预览 | `{type:'previewSession', id}` |
| 会话 `data-act="open"` | 在 Claude 中恢复 | `{type:'openSession', id}` |
| 会话 `data-act="preview"` | 预览 | `{type:'previewSession', id}` |
| 顶栏刷新（若有） | 刷新 | `{type:'refresh'}` |

### 2.4 分段控件（看板 / 列表）

点 `.seg__btn` → `setView(value)`：
- 更新 `seg.dataset.i`（CSS 靠它平移滑块）
- 切换 `.is-on` 和 `aria-selected`
- `vscode.setState({view})` **并且** `vscode.postMessage({type:'setView', value})`
  （双保险：webview 状态可能被回收，扩展侧的 workspaceState 更持久）
- 重渲染项目区

### 2.5 预览抽屉

收到 `{type:'preview', payload}` 时填充并打开抽屉（DOM 见下），`Esc` 或点遮罩关闭。

```html
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true">
  <div class="drawer__grip"></div>
  <div class="drawer__head">
    <div class="drawer__t">会话标题</div>
    <div class="drawer__m"><span>18 天前</span><span>·</span><span>30 次提问</span><span>·</span><span>master</span></div>
  </div>
  <div class="drawer__body">
    <div class="quote">首条提问原文（保留换行）</div>
    <div class="reply">最后一条回复…</div>
    <div class="reply">倒数第二条…</div>
  </div>
  <div class="drawer__foot">
    <button class="btn"   data-act="open">在 Claude 中打开</button>
    <button class="btn btn--2" data-act="close">关闭</button>
  </div>
</aside>
```

`.scrim` / `.drawer` / `.quote` / `.reply` / `.btn` 的样式都已在 CSS 里。
开关靠 `is-open` 类。**抽屉节点在初始 HTML 里就存在**，
只是通过类控制显隐 —— 不要每次重建它。

⚠️ 文本一律用 `textContent` 赋值或先做 HTML 转义，**不要直接 `innerHTML` 塞用户数据**
（会话标题来自 jsonl，可能含 `<` `>`）。

### 2.6 主题 与 玻璃开关

VS Code 会自动在 `<body>` 上加 `.vscode-light` / `.vscode-dark` /
`.vscode-high-contrast` 类，**基础样式**（`media/style.css`）已经按这些类分叉，
那部分你不用管。

但**玻璃层**（`media/glass.css`）需要一个 `body.glass-on` 类才会生效。
这个类由你在 `main.js` 里控制：

```js
function syncGlass() {
  const mode = (state.glass || 'auto');           // 来自快照
  const cls = document.body.classList;
  const isHighContrast = cls.contains('vscode-high-contrast')
                      || cls.contains('vscode-high-contrast-light');
  const isDark = cls.contains('vscode-dark');
  // 高对比主题一律不开玻璃：半透明会削弱对比度，伤害可访问性
  const on = !isHighContrast && (mode === 'on' || (mode === 'auto' && isDark));
  cls.toggle('glass-on', on);
}
```

**必须在两个时机调用**：
1. 每次收到 `state` 消息、`state` 更新之后
2. **主题切换时** —— VS Code 换主题不会发消息，只会改 `body` 的 class。
   所以要挂一个监听：

```js
new MutationObserver(syncGlass).observe(document.body, {
  attributes: true, attributeFilter: ['class']
});
```

对应地，扩展侧要做两件事（**这两件也归你做**）：
- `src/store.js` 的 `getSnapshot()` 里加一个字段：
  `glass: vscode.workspace.getConfiguration('taskboard').get('glassEffect') || 'auto'`
- 在 `src/extension.js` 的 `activate` 里监听配置变化并重推快照，让改设置立刻生效：
  ```js
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('taskboard.glassEffect')) store.refresh();
  });
  ```
  （`package.json` 里的 `taskboard.glassEffect` 配置项**已经加好，不要改 manifest**）

**不要**在 `main.js` 里用 `matchMedia('(prefers-color-scheme: dark)')` ——
那读的是操作系统主题，不是 VS Code 主题，两者可以不同。

---

## 3. 更新 `dev/preview.html`

让它加载 `../media/views.js` 而不是 `preview-render.js`，
并让 `dev/preview-data.js` 的数据形状与真实快照对齐
（补上 `claude: {installed:true}`、`errors: []`）。

这样沙盘和真机用**同一份渲染代码**，避免漂移。沙盘仍是我做视觉迭代的工具，**不要删**。

---

## 验收

1. 起静态服务打开 `dev/preview.html`，看板视图和列表视图都要正常渲染，控制台无报错
2. 截图（明暗各一张）附在报告里
3. `node --check media/views.js` 和 `node --check media/main.js` 语法通过
4. 报告里明确列出：你**不确定**的地方、你**假设**了什么

有做不到或不确定的，**明说**，不要编造。
