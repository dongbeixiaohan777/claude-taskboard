'use strict';

// 回归测试：media/main.js 的增量更新路径依赖 media/views.js 暴露的辅助函数。
//
// 背景（真踩过的坑）：syncSessionNode 里调了裸的 nodeSize()，而 views.js 只把
// nodeSize 定义在 IIFE 内部、没挂到 window 上。于是每次收到新快照，
// syncSessions → syncSessionNode 都抛 ReferenceError，forEach 中断在第一个会话，
// placeInOrder 永远执行不到 —— 表现是「时间文案会更新，但顺序永远不变、
// 新会话永远不出现」。首屏走的是整页 innerHTML，不经过这条路径，所以打开时是好的。
//
// 这条测试把「views.js 的内部函数，main.js 不能裸调」变成硬约束。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MEDIA = path.join(__dirname, '..', 'media');
const readMedia = (name) => fs.readFileSync(path.join(MEDIA, name), 'utf8');

function loadRendererWindow() {
  const window = {};
  for (const file of ['i18n.js', 'views.js']) {
    vm.runInNewContext(readMedia(file), { window, T: window.T });
  }
  return window;
}

// views.js IIFE 里的顶层函数名（缩进两格）
function rendererHelperNames() {
  return new Set(
    [...readMedia('views.js').matchAll(/^ {2}function ([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1])
  );
}

// main.js 自己声明的名字，裸调它们不算越界
function locallyDeclared(source) {
  const names = new Set();
  for (const m of source.matchAll(/(?:^|\s)(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
}

test('views.js 的内部函数，main.js 不能裸调（必须走 window.*）', () => {
  const helpers = rendererHelperNames();
  assert.ok(helpers.has('nodeSize'), '前提检查：nodeSize 应是 views.js 的内部函数');

  const mainSource = readMedia('main.js');
  const local = locallyDeclared(mainSource);
  const window = loadRendererWindow();

  const violations = [...helpers].filter((name) => {
    if (local.has(name)) return false;                        // main.js 自己有同名声明
    const used = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`).test(mainSource) ||
      new RegExp(`window\\.${name}\\s*\\(`).test(mainSource);
    if (!used) return false;                                  // main.js 根本没用到
    return typeof window[name] !== 'function';                // 用了但没导出 → 运行时会炸
  });

  assert.deepEqual(violations, [],
    `main.js 裸调了 views.js 未导出的函数：${violations.join(', ')}（改成 window.xxx() 并在 views.js 里导出）`);
});

test('会话节点的大小编码，渲染侧和增量更新侧必须一致', () => {
  const window = loadRendererWindow();
  assert.equal(typeof window.nodeSize, 'function');

  const html = window.renderSession(
    { id: 's1', title: 't', promptCount: 3, ago: '刚刚', branch: null, empty: false }, 0, true
  );
  assert.equal(window.nodeSize(3), '8px');
  assert.match(html, /--node:8px/);
  assert.equal(window.nodeSize(0), '5px');
  assert.equal(window.nodeSize(99), '10px');
});
