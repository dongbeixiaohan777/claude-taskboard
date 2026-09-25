// 批量出图 —— 一条命令渲染全部面板变体，零依赖。
//
// 为什么要有这个脚本：
// 逐张手工截图是「navigate → 截图 → 看结果」的多次往返，而 Chromium 画一屏只要 3ms。
// 真正的开销在往返和读图上，不在渲染。这个脚本把「渲染 + 落盘」压成一次进程调用，
// 之后只需要读少数几张图判断观感。
//
// 用法：
//   node dev/render-all.mjs                 # 出 README 用的那几张（默认）
//   node dev/render-all.mjs --set all       # 所有主题×视图×语言组合
//   node dev/render-all.mjs --out /tmp/x    # 换输出目录
//
// 依赖：系统装的 Chrome 或 Edge（不装任何 npm 包）。
// 用 --virtual-time-budget 等 JS 渲染完再截，不用 sleep 猜时间。

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8789; // 刻意避开 8788（给手工沙盘留着）

// ── 命令行参数 ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getFlag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SET = getFlag('--set', 'readme');
const OUT = path.resolve(getFlag('--out', path.join(ROOT, 'docs')));

// ── 变体定义 ──────────────────────────────────────────────────
// README 用的三张：英文看板（浅）、英文列表（深，展示玻璃）、中文看板
const README_SET = [
  { file: 'screenshot-board.png',     theme: 'light', view: 'board', locale: 'en' },
  { file: 'screenshot-list-dark.png', theme: 'dark',  view: 'list',  locale: 'en' },
  { file: 'screenshot-zh-CN.png',     theme: 'light', view: 'board', locale: 'zh-cn' }
];

// 全组合：2 主题 × 2 视图 × 2 语言 = 8 张
const ALL_SET = [];
for (const theme of ['light', 'dark']) {
  for (const view of ['board', 'list']) {
    for (const locale of ['en', 'zh-cn']) {
      ALL_SET.push({
        file: `gen-${theme}-${view}-${locale}.png`,
        theme, view, locale
      });
    }
  }
}

const VARIANTS = SET === 'all' ? ALL_SET : README_SET;

// ── 找浏览器 ──────────────────────────────────────────────────
function findBrowser() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    // 非默认安装位置：允许用环境变量覆盖
    process.env.CHROME_PATH,
    process.env.EDGE_PATH
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

// ── 静态服务（只服务本仓库，拒绝路径穿越）─────────────────────
function startServer() {
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png'
  };
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('404 ' + rel);
    }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

// ── 单张截图 ──────────────────────────────────────────────────
function shoot(browser, url, outFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-extensions',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',   // 2x 输出，README 在高分屏上不糊
      '--window-size=320,900',
      '--virtual-time-budget=2500',      // 等 JS 渲染完，别用 sleep 猜
      '--user-data-dir=' + path.join(ROOT, 'dev', '.chrome-profile'),
      `--screenshot=${outFile}`,
      url
    ];
    const child = spawn(browser, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('exit ' + code))));
  });
}

// ── 主流程 ────────────────────────────────────────────────────
const browser = findBrowser();
if (!browser) {
  console.error('❌ 找不到 Chrome 或 Edge。设 CHROME_PATH 环境变量指向浏览器可执行文件。');
  process.exit(1);
}
console.log(`浏览器: ${path.basename(browser)}`);
console.log(`变体:   ${VARIANTS.length} 个（--set ${SET}）`);
console.log(`输出:   ${OUT}\n`);

await mkdir(OUT, { recursive: true });
const server = await startServer();

const t0 = Date.now();
let ok = 0;
for (const v of VARIANTS) {
  const url = `http://127.0.0.1:${PORT}/dev/shot.html?theme=${v.theme}&view=${v.view}&locale=${v.locale}`;
  const out = path.join(OUT, v.file);
  const t = Date.now();
  try {
    await shoot(browser, url, out);
    const size = (await stat(out)).size;
    console.log(`  ✅ ${v.file.padEnd(30)} ${String(Date.now() - t).padStart(5)}ms  ${(size / 1024).toFixed(0)} KB`);
    ok++;
  } catch (e) {
    console.log(`  ❌ ${v.file.padEnd(30)} ${e.message}`);
  }
}

server.close();
const total = Date.now() - t0;
console.log(`\n完成 ${ok}/${VARIANTS.length}，总耗时 ${(total / 1000).toFixed(1)}s（平均 ${(total / VARIANTS.length).toFixed(0)}ms/张）`);
console.log('提示：这批图是从 dev/demo-data.js 的中性演示数据渲染的，不含真实项目信息。');
