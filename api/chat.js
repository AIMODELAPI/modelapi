// ============================================================
// Vercel Serverless Function · POST /api/chat
// 复用与本地相同的 Harness 核心引擎
// 部署：推到 GitHub 后，在 Vercel 导入仓库即可（无需构建）
// 配置真实上游：在 Vercel 项目 Settings → Environment Variables 加
//   UPSTREAM_BASE_URL 与 UPSTREAM_API_KEY
// ============================================================
const core = require('../harness-core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  try {
    const out = await core.handleChat(body || {}, process.env);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
};
