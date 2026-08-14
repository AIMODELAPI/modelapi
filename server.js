// ============================================================
// ModelAPI · 本地开发服务器（零依赖）
// 同时托管静态站点与 /api/* 接口
// 运行：node server.js  →  http://localhost:3000
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('./harness-core');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function sendJson(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => { chunks.push(c); if (Buffer.concat(chunks).length > 5e6) req.destroy(); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // 防目录穿越
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 兜底：未知路径回 index
      const fallback = path.join(ROOT, 'index.html');
      fs.readFile(fallback, (e2, data) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (e3, data) => {
      if (e3) { res.writeHead(500); return res.end('Error'); }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/chat') {
      const raw = await readBody(req);
      let parsed; try { parsed = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }
      try {
        const out = await core.handleChat(parsed, process.env);
        return sendJson(res, 200, out);
      } catch (e) {
        return sendJson(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    }
    if (req.method === 'POST' && req.url === '/api/image') {
      const raw = await readBody(req);
      let parsed; try { parsed = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }
      const prompt = (parsed.prompt || '').trim();
      if (!prompt) return sendJson(res, 400, { error: 'prompt 不能为空' });
      const baseUrl = (process.env.IMAGE_BASE_URL || 'https://api.aimodelapi.ai/v1').replace(/\/$/, '');
      const apiKey = process.env.IMAGE_API_KEY;
      if (!apiKey) return sendJson(res, 200, { demo: true, message: '未配置 IMAGE_API_KEY，当前为演示模式。请在环境变量中配置 IMAGE_API_KEY 后即可真实生图。', prompt });
      try {
        const up = await fetch(baseUrl + '/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ model: parsed.model || 'IMG-bl-wan2.7-image', prompt, n: parsed.n || 1, size: parsed.size || '1024x1024' }),
        });
        if (!up.ok) return sendJson(res, 502, { error: '生图上游返回 ' + up.status });
        const data = await up.json();
        return sendJson(res, 200, data);
      } catch (e) {
        return sendJson(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    }
    if (req.method === 'POST' && req.url === '/api/video') {
      const raw = await readBody(req);
      let parsed; try { parsed = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }
      const prompt = (parsed.prompt || '').trim();
      if (!prompt) return sendJson(res, 400, { error: 'prompt 不能为空' });
      const baseUrl = (process.env.VIDEO_BASE_URL || 'https://api.aimodelapi.ai/v1').replace(/\/$/, '');
      const apiKey = process.env.VIDEO_API_KEY;
      const model = parsed.model || 'WAN-t2v-2.7';
      const duration = Number(parsed.duration) || 5;
      const resolution = parsed.resolution || '720p';
      if (!apiKey) return sendJson(res, 200, { pending: true, message: '视频生成功能对接中，敬请期待。', prompt, duration, resolution });
      try {
        const up = await fetch(baseUrl + '/video/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ model, prompt, duration, resolution }),
        });
        if (!up.ok) return sendJson(res, 502, { error: '视频生成上游返回 ' + up.status });
        const data = await up.json();
        return sendJson(res, 200, data);
      } catch (e) {
        return sendJson(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    }
    if (req.method === 'GET' && req.url === '/api/models') {
      return sendJson(res, 200, { models: core.getModels() });
    }
    if (req.method === 'GET' && req.url === '/api/harness/stats') {
      return sendJson(res, 200, core.getStats());
    }
    if (req.method === 'GET' && req.url === '/api/health') {
      return sendJson(res, 200, { ok: true, cache_mode: process.env.UPSTREAM_API_KEY ? 'live' : 'demo' });
    }
    serveStatic(req, res);
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, () => {
  const mode = process.env.UPSTREAM_API_KEY ? '真实上游（已配置密钥）' : '演示仿真（未配置密钥）';
  console.log('ModelAPI playground → http://localhost:' + PORT);
  console.log('Harness 模式：' + mode);
});
