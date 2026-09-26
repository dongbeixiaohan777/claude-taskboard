// 开发用的静态服务器 —— 给 dev/ 下的诊断页用（浏览器不允许从 file:// 加载模块/发请求）。
//
//   node dev/serve.mjs        # http://localhost:8791/dev/reorder-test.html
//
// 除了发静态文件，还提供一个 POST /__digest：把 Markdown 洗成抽屉里那份纯文本，
// 直接调用扩展侧的 src/lib/format.js。为什么不让诊断页自己手写一份清洗规则：
// 那样页面里显示的就不是真机上要显示的东西了，改了实现也看不出来。
// 只服务本地文件，不要拿它当生产服务器。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8791); // 避开 render-all.mjs 用的 8789
const { plainify, truncate } = require(path.join(ROOT, 'src', 'lib', 'format.js'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/__digest') {
    let body = '';
    for await (const chunk of request) body += chunk;
    let text = '';
    let max = 900;
    try {
      const parsed = JSON.parse(body);
      text = parsed?.text || '';
      max = Number(parsed?.max) || 900;
    } catch {
      // 空 body / 坏 JSON 都当空文本处理，别让诊断页白屏
    }
    response.writeHead(200, { 'content-type': TYPES['.json'] });
    response.end(JSON.stringify({ text: truncate(plainify(text), max) }));
    return;
  }

  try {
    const target = path.join(ROOT, decodeURIComponent(request.url.split('?')[0]));
    if (!target.startsWith(ROOT)) throw Object.assign(new Error('越界'), { code: 'EACCES' });
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': TYPES[path.extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
}).listen(PORT, () => {
  console.log(`dev server: http://localhost:${PORT}/dev/reorder-test.html`);
});
