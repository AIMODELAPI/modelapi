// ============================================================
// ModelAPI · 本地开发服务器（零依赖）
// 同时托管静态站点与 /api/image、/api/video 接口
// 运行：node server.js  →  http://localhost:3000
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  '.mp4': 'video/mp4',
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
    // AI 生图
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
    // AI 视频：提交任务（POST）
    if (req.method === 'POST' && req.url === '/api/video') {
      const raw = await readBody(req);
      let parsed; try { parsed = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }
      const prompt = (parsed.prompt || '').trim();
      if (!prompt) return sendJson(res, 400, { error: 'prompt 不能为空' });
      const baseUrl = (process.env.VIDEO_BASE_URL || 'https://api.aimodelapi.ai/v1').replace(/\/$/, '');
      const apiKey = process.env.VIDEO_API_KEY;
      if (!apiKey) return sendJson(res, 200, { pending: true, message: '视频生成功能对接中，敬请期待。', prompt });
      const payload = {
        model: parsed.model || 'WAN-t2v-2.7',
        prompt,
        duration: Number(parsed.duration) || 5,
        resolution: parsed.resolution || '720P',
      };
      if (parsed.negative_prompt) payload.negative_prompt = parsed.negative_prompt;
      if (typeof parsed.prompt_optimization === 'boolean') payload.prompt_optimization = parsed.prompt_optimization;
      if (parsed.first_frame_image || parsed.image) payload.first_frame_image = parsed.first_frame_image || parsed.image;
      if (parsed.reference_video || parsed.video) payload.reference_video = parsed.reference_video || parsed.video;
      try {
        const up = await fetch(baseUrl + '/contents/generations/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify(payload),
        });
        const data = await up.json().catch(() => ({}));
        if (!up.ok) return sendJson(res, 502, { error: '提交任务失败 ' + up.status, detail: JSON.stringify(data).slice(0, 300) });
        const taskId = data.task_id || data.id || data.request_id || (data.data && (data.data.task_id || data.data.id));
        if (!taskId) return sendJson(res, 200, { error: '未获取到 task_id', raw: data });
        return sendJson(res, 200, { task_id: String(taskId) });
      } catch (e) {
        return sendJson(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    }
    // AI 视频：查询任务（GET /api/video?task_id=）
    if (req.method === 'GET' && req.url.startsWith('/api/video')) {
      let taskId = '';
      try { taskId = new URL(req.url, 'http://localhost').searchParams.get('task_id') || ''; } catch (_) {}
      if (!taskId) return sendJson(res, 400, { error: '缺少 task_id' });
      const baseUrl = (process.env.VIDEO_BASE_URL || 'https://api.aimodelapi.ai/v1').replace(/\/$/, '');
      const apiKey = process.env.VIDEO_API_KEY;
      if (!apiKey) return sendJson(res, 200, { pending: true, message: '视频生成功能对接中，敬请期待。' });
      try {
        const up = await fetch(baseUrl + '/contents/generations/tasks/' + encodeURIComponent(taskId), {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + apiKey },
        });
        const data = await up.json().catch(() => ({}));
        if (!up.ok) return sendJson(res, 502, { error: '查询任务失败 ' + up.status });
        const status = String(data.status || (data.data && data.data.status) || '').toLowerCase();
        const videoUrl = data.video_url || data.url || (data.data && (data.data.video_url || data.data.url)) || (data.output && (data.output.video_url || data.output.url));
        if (['succeeded', 'success', 'completed', 'done', 'finished'].indexOf(status) >= 0 && videoUrl) {
          return sendJson(res, 200, { status: 'succeeded', video_url: videoUrl });
        }
        if (['failed', 'fail', 'error', 'cancelled', 'canceled'].indexOf(status) >= 0) {
          return sendJson(res, 200, { status: 'failed', error: String(data.error || data.message || '生成失败') });
        }
        return sendJson(res, 200, { status: 'processing', raw_status: status || 'pending' });
      } catch (e) {
        return sendJson(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    }
    // 健康检查
    if (req.method === 'GET' && req.url === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        image: process.env.IMAGE_API_KEY ? 'live' : 'demo',
        video: process.env.VIDEO_API_KEY ? 'live' : 'pending',
      });
    }
    serveStatic(req, res);
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, () => {
  console.log('ModelAPI 生图/视频站 → http://localhost:' + PORT);
  console.log('生图模式：' + (process.env.IMAGE_API_KEY ? '真实（已配置密钥）' : '演示（未配置密钥）'));
  console.log('视频模式：' + (process.env.VIDEO_API_KEY ? '真实（已配置密钥）' : '对接中（未配置密钥）'));
});
