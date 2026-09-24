# 任务面板 · vscode-taskboard

VS Code 侧边栏面板。把**项目文档**和 **Claude Code 会话**集中到一处，
解决「21 个会话跨 2 个月，找不到上次聊到哪」和「文档在 KB、代码在 projects，两处分开」这两件事。

只读工具 —— **不会修改你的任何文件**。

---

## 界面

活动栏（左侧最窄那条竖栏）最下方有一个图标，点开就是面板。三块内容：

1. **统计条** —— 项目数 / 会话数 / 本周提问数
2. **工作脉搏** —— 最近 8 周每周的提问数。空白的周会留一根极淡的基线，
   让「那周什么都没干」也看得见。这是面板的签名元素
3. **项目 / 会话** —— 项目支持「看板」「列表」两种视图切换；会话是时间线，节点大小 = 提问数

配色跟随 VS Code 主题自动切换明暗，不写死任何颜色。

---

## 设置

| 设置项 | 默认 | 说明 |
|---|---|---|
| `taskboard.glassEffect` | `auto` | 液态玻璃质感的开关 |
| `taskboard.projectsDir` | 空 | 项目文档目录；留空则用工作区下的 `KB/02-项目` |

### `taskboard.glassEffect` 的三个取值

- **`auto`（默认）** —— 深色主题用玻璃，浅色主题用扁平
- **`on`** —— 任何主题都开玻璃
- **`off`** —— 始终扁平

**为什么默认是 auto**：玻璃的观感来自「透出背后的东西」。深色主题底色暗，
环境光透出来的层次感强；浅色主题是一整片浅灰，玻璃层会把「白卡片浮在灰底上」
的清爽对比糊掉。实测两种主题下结论不同，所以默认按主题自动切。

在 VS Code 里改：`Ctrl + ,` 打开设置 → 搜「任务面板」→ 改完**立即生效，不用重载窗口**。

> 高对比主题（High Contrast）会自动排除玻璃 —— 半透明会削弱对比度，伤害可访问性。
> 系统级「减少动态效果」开启时，玻璃的模糊也会自动关闭。

---

## 安装

### 方式一：直接挂载（推荐，无需手动操作）

扩展以目录联接（junction）方式挂到 VS Code 的扩展目录，改代码后只需重载窗口：

```powershell
# 以管理员或普通用户身份运行（junction 不需要管理员）
cmd /c mklink /J "%USERPROFILE%\.vscode\extensions\local.vscode-taskboard-0.1.0" "D:\Claude\projects\vscode-taskboard"
```

然后**重启 VS Code**。

==卸载==：删掉 `%USERPROFILE%\.vscode\extensions\local.vscode-taskboard-0.1.0` 这个联接即可。

### 方式二：从文件夹安装（图形界面）

1. `Ctrl + Shift + P` 打开命令面板
2. 输入 `Install Extension from Location`
3. 点第一项 → 在弹出的文件夹选择框顶部的**地址栏**粘贴
   `D:\Claude\projects\vscode-taskboard` → 回车 → 点「选择文件夹」
4. 提示重新加载时点 **「重新加载窗口」**
5. 看活动栏**最下面**是否出现新图标

### 方式三：打包成 .vsix

```bash
npm install
npx @vscode/vsce package --allow-missing-repository
```
然后命令面板 → `Extensions: Install from VSIX...` → 选生成的 `.vsix`。

### 图标位置说明（重要）

VS Code **没有**提供「把扩展图标钉到活动栏底部」的 API。实测行为是：

- **首次安装时**图标会出现在活动栏**最下方**，就在账户和设置齿轮正上方
- 如果之后**又装了别的**带活动栏图标的扩展，那个会排到你下面
- 想固定位置：**鼠标按住图标拖到底部松手**，VS Code 会记住，跨重启保留

「账户」和「设置」两个按钮永远是最后两个，任何扩展都排不到它们下面 —— 这是 VS Code 的硬限制。

---

## 使用

| 操作 | 结果 |
|---|---|
| 点项目卡片 | 打开该项目的 `README.md` |
| 点卡片上的 ↗ 按钮 | 在资源管理器中定位该项目文件夹 |
| 点会话条目 | 弹出预览抽屉：首条提问 + 最后 3 条回复 |
| 点会话上的 💬 按钮 | **在 Claude Code 扩展里恢复这个会话**（不是开终端） |
| 顶栏「看板 / 列表」 | 切换项目区的呈现方式，选择会被记住 |
| 命令面板 `任务面板：刷新` | 强制重扫 |
| 命令面板 `任务面板：切换看板 / 列表` | 同顶栏切换 |

面板会自动跟随文件变化刷新（去抖 1.5 秒）。

> **预览不需要装 Claude 扩展**，它只读 `.jsonl` 文件。
> 但「恢复会话」需要 Claude Code 扩展在场，没装的话按钮会变成安装提示。

---

## 数据从哪来

### 项目 —— `D:\Claude\KB\02-项目\`

状态编码在**目录名后缀**里（`项目名-状态`）。每个项目卡片显示状态、文档数、最后修改时间、README 摘要。

⚠️ 解析器**同时接受规范内和规范外的状态词**，因为实际数据里两者都有：

| 词 | 来源 |
|---|---|
| `规划中` / `开发中` / `已归档` | 符合 `KB/02-项目/README.md` 的规范 |
| `已完成` | **不在规范里**，但实际在用（`语音输入助手-已完成`） |
| `已上线` | 规范里有，实际暂未使用，一并支持 |
| 无后缀 | 归入「未标注」，**不丢弃**（如 `漫剧测试片`） |

### 会话 —— `%USERPROFILE%\.claude\projects\<工作区编码名>\*.jsonl`

**不猜目录名的编码规则**（`d:\Claude` → `d--Claude` 只是观察到的现象，不是契约）。
实际做法是遍历该根目录下的所有子目录，读 `jsonl` 里的 `cwd` 字段反查真实工作区路径 —— 
即使 Claude Code 改了编码实现也依然正确。

**提问计数口径**（用真实数据校准过，21 个会话合计 142 条）：

| 记录形态 | 处理 |
|---|---|
| 正常文本 | ✅ 计入 |
| `<task-notification>` | ❌ 排除（系统生成的后台任务通知） |
| `<command-name>` / `<command-message>` 等 | ❌ 排除（斜杠命令调用，不算提问） |
| `<ide_opened_file>…</ide_opened_file>开工` | ⚠️ **剥掉标签，保留「开工」** —— 整条丢弃会丢真实提问 |
| `[Image: …]` | ❌ 排除（实测全部带 `isMeta`） |
| 含 `tool_result` 的记录 | ❌ 排除（工具返回值，不是提问） |

**标题**取三级回退：`ai-title`（取最后一条，标题会演化）→ `custom-title`（用户手动改名）
→ 首条真实提问截断 → `(空会话)`。

**时间戳**对全部带 timestamp 的行排序取 min/max —— 实测存在乱序条目，
取首行/末行会算错。

---

## 开发

```bash
node --test test/*.test.js    # 单元测试，零依赖，用 Node 内置测试框架
node test/smoke.mjs           # 真机冒烟：扫真实的 .claude/projects 并打印表格
```

改完代码后：命令面板 → `Reload Window`。

### 目录结构

```
src/extension.js       激活入口，纯装配
src/store.js           唯一数据源：扫描 + 缓存 + 事件
src/panel.js           WebviewViewProvider（CSP / nonce / 消息协议）
src/claude.js          Claude 扩展集成（★ 最易随对方版本失效的一处）
src/watcher.js         文件监听 + 去抖 + 兜底轮询
src/cache.js           扫描结果落盘缓存（原子写）
src/logger.js          输出通道「任务面板」
src/lib/               纯 Node，不 require('vscode')，可单测
  ├─ jsonl.js          单行解析 + 噪音判定
  ├─ sessionScanner.js 会话扫描（流式，24MB 文件不爆内存）
  ├─ projectScanner.js 项目扫描
  ├─ paths.js          路径推导 + cwd 反查
  └─ format.js         格式化
media/                 webview 前端
  ├─ style.css         设计系统（明暗自适应，改颜色只改这里）
  ├─ views.js          渲染
  └─ main.js           交互与消息
dev/preview.html       设计沙盘：本地静态服务打开可看成品，用于视觉迭代
docs/                  给 Codex 的任务书（含逆向得到的接口事实）
```

### 两条刻意的偏离

1. **不写 `"type": "module"`。** 本仓库其他项目是 ESM，但 VS Code 扩展宿主里
    ESM 会让 `require('vscode')` 报 `require is not defined`。所以这里用 CommonJS。
2. **零构建步骤。** 没有 TypeScript、没有打包器。代价是没有类型检查，
   缓解手段是 `src/lib/` 那一层不依赖 `vscode`，可以纯 Node 单测。

### 主题变量必须挂在 `body` 而不是 `:root`

`--vscode-*` 由 VS Code 在运行时注入（落在 `body` 上）。若把
`--c-bg: var(--vscode-sideBar-background)` 这类派生令牌定义在 `:root`，
解析时取不到 `body` 上的值，会**静默回落到兜底值** —— 表现为「切主题完全没反应」。
这是个真踩过的坑。

---

## 已知限制

- **Claude 集成基于 `anthropic.claude-code` 2.1.281 逆向**。用到了内部命令
  `claude-vscode.editor.open(sessionId, …)` 和公开深链
  `vscode://anthropic.claude-code/open?session=<id>`。
  对方升级后若失效，`src/claude.js` 顶部的常量改一行即可，且有深链兜底。
- **活动栏位置**受 VS Code 限制，见上文「图标位置说明」。
- **会话计数口径**：斜杠命令（`/money` 等）不计入提问数。
  这是刻意选择 —— 用户在同一条会话里通常还会发真实需求，都算会重复计数。
- 面板是**只读**的，不支持在面板里新建/编辑任何东西。
