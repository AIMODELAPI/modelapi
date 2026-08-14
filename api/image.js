// ============================================================
// Vercel Serverless Function · POST /api/image
// AI 生图：调用 aimodelapi.ai 平台（OpenAI 兼容 images/generations）
// 部署：Vercel 项目 Settings → Environment Variables 加
//   IMAGE_BASE_URL（默认 https://api.aimodelapi.ai/v1）与 IMAGE_API_KEY
// 合规：本接口是「官方授权 AI 生图平台」的正向接入，不做任何违规中转/转售。
// ============================================================
const DEFAULT_BASE = 'https://api.aimodelapi.ai/v1';
const DEFAULT_MODEL = 'IMG-bl-wan2.7-image';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  body = body || {};
  const prompt = (body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'prompt 不能为空' });

  const baseUrl = (process.env.IMAGE_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = process.env.IMAGE_API_KEY;

  // 未配置密钥 → 演示提示（与 Harness 演示模式一致的兜底）
  if (!apiKey) {
    return res.status(200).json({
      demo: true,
      message: '未配置 IMAGE_API_KEY，当前为演示模式。请在 Vercel 环境变量中配置 IMAGE_API_KEY 后即可真实生图。',
      prompt,
    });
  }

  try {
    const upstream = await fetch(baseUrl + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: body.model || DEFAULT_MODEL,
        prompt,
        n: body.n || 1,
        size: body.size || '1024x1024',
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: '生图上游返回 ' + upstream.status, detail: detail.slice(0, 300) });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
};
