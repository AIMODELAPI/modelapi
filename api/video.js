// ============================================================
// Vercel Serverless Function · POST /api/video
// AI 视频生成：调用 aimodelapi.ai 平台（通义万相 Wan 系列）
// 部署：Vercel 项目 Settings → Environment Variables 加
//   VIDEO_BASE_URL（默认 https://api.aimodelapi.ai/v1）与 VIDEO_API_KEY
// 状态：接口对接中 —— 待 aimodelapi.ai 确认视频接口路径/参数后，
//       把下方 TODO 处替换为真实调用即可。
// 合规：本接口是「官方授权 AI 视频生成平台」的正向接入，不做任何违规中转/转售。
// ============================================================
const DEFAULT_BASE = 'https://api.aimodelapi.ai/v1';
const DEFAULT_MODEL = 'WAN-t2v-2.7';

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

  const baseUrl = (process.env.VIDEO_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = process.env.VIDEO_API_KEY;
  const model = body.model || DEFAULT_MODEL;
  const duration = Number(body.duration) || 5;
  const resolution = body.resolution || '720p';

  // TODO: 待 aimodelapi.ai 确认视频接口（路径 + 参数 + 同步/异步）后，替换下面这段。
  // 预期调用形如（以最终文档为准）：
  //   POST baseUrl + '/video/generations' 或异步任务接口
  //   参数：{ model, prompt, duration, resolution }
  // 未配置密钥或接口未确认前，返回「对接中」提示：
  if (!apiKey) {
    return res.status(200).json({
      pending: true,
      message: '视频生成功能对接中，敬请期待。当前已记录你的需求：' + prompt,
      prompt, duration, resolution,
    });
  }

  try {
    // 真实调用（接口确认后启用）
    const upstream = await fetch(baseUrl + '/video/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model, prompt, duration, resolution }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: '视频生成上游返回 ' + upstream.status, detail: detail.slice(0, 300) });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
};
