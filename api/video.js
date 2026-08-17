// ============================================================
// Vercel Serverless Function · /api/video
// AI 视频生成：调用 aimodelapi.ai 平台（异步任务）
//   POST /api/video            提交任务 → 返回 { task_id }
//   GET  /api/video?task_id=   查询任务 → 返回 { status, video_url }
// 部署：Vercel 环境变量
//   VIDEO_BASE_URL（默认 https://sg.api.aimodelapi.ai/v1，亚太节点）
//   VIDEO_API_KEY
// 合规：官方授权 AI 视频生成平台的正向接入，不做违规中转/转售。
// ============================================================
const DEFAULT_BASE = 'https://api.aimodelapi.ai/v1';
const DEFAULT_MODEL = 'WAN-t2v-2.7';

// 从对象里按候选字段名取值（平台返回字段名可能变化，做宽松兼容）
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

module.exports = async (req, res) => {
  const baseUrl = (process.env.VIDEO_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = process.env.VIDEO_API_KEY;

  // 未配置密钥 → 对接中提示
  if (!apiKey) {
    return res.status(200).json({ pending: true, message: '视频生成功能对接中，敬请期待。' });
  }

  // ── 查询任务 ──
  if (req.method === 'GET') {
    const taskId = (req.query && (req.query.task_id || req.query.taskId)) || '';
    if (!taskId) return res.status(400).json({ error: '缺少 task_id' });
    try {
      const up = await fetch(baseUrl + '/contents/generations/tasks/' + encodeURIComponent(taskId), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      });
      const data = await up.json().catch(function () { return {}; });
      if (!up.ok) {
        return res.status(up.status).json({ error: '查询任务失败 ' + up.status, detail: JSON.stringify(data).slice(0, 300) });
      }
      const status = String(
        pick(data, ['status', 'task_status', 'state']) ||
        pick(data.data, ['status', 'task_status', 'state']) ||
        ''
      ).toLowerCase();
      const videoUrl =
        pick(data, ['video_url', 'url', 'result_url', 'output_url']) ||
        pick(data.data, ['video_url', 'url', 'result_url', 'output_url']) ||
        pick(data.output, ['video_url', 'url']) ||
        pick(data.result, ['video_url', 'url']);
      const isDone = ['succeeded', 'success', 'completed', 'done', 'finished', 'successful'].indexOf(status) >= 0;
      const isFailed = ['failed', 'fail', 'error', 'cancelled', 'canceled'].indexOf(status) >= 0;
      if (isDone && videoUrl) {
        return res.status(200).json({ status: 'succeeded', video_url: videoUrl });
      }
      if (isFailed) {
        const errMsg = pick(data, ['error', 'message', 'failure_reason', 'fail_reason']) || '生成失败';
        return res.status(200).json({ status: 'failed', error: String(errMsg) });
      }
      // 处理中
      return res.status(200).json({ status: 'processing', raw_status: status || 'pending' });
    } catch (e) {
      return res.status(502).json({ error: String(e && e.message ? e.message : e) });
    }
  }

  // ── 提交任务 ──
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    body = body || {};
    const prompt = (body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'prompt 不能为空' });

    const payload = {
      model: body.model || DEFAULT_MODEL,
      prompt: prompt,
      duration: Number(body.duration) || 5,
      resolution: body.resolution || '720P',
    };
    if (body.negative_prompt) payload.negative_prompt = body.negative_prompt;
    if (typeof body.prompt_optimization === 'boolean') payload.prompt_optimization = body.prompt_optimization;
    if (typeof body.multi_shot === 'boolean') payload.multi_shot = body.multi_shot;
    if (typeof body.strict_duration === 'boolean') payload.strict_duration = body.strict_duration;
    if (body.first_frame_image || body.image) payload.first_frame_image = body.first_frame_image || body.image;
    if (body.reference_video || body.video) payload.reference_video = body.reference_video || body.video;
    if (body.ratio) payload.ratio = body.ratio;

    try {
      const up = await fetch(baseUrl + '/contents/generations/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify(payload),
      });
      const data = await up.json().catch(function () { return {}; });
      if (!up.ok) {
        return res.status(up.status).json({ error: '提交任务失败 ' + up.status, detail: JSON.stringify(data).slice(0, 300) });
      }
      const taskId =
        pick(data, ['task_id', 'id', 'request_id', 'job_id']) ||
        pick(data.data, ['task_id', 'id', 'request_id', 'job_id']);
      if (!taskId) {
        // 拿不到 task_id：把原始返回透传，方便调试
        return res.status(200).json({ error: '未获取到 task_id', raw: data });
      }
      return res.status(200).json({ task_id: String(taskId) });
    } catch (e) {
      return res.status(502).json({ error: String(e && e.message ? e.message : e) });
    }
  }

  res.setHeader('Allow', 'POST, GET');
  return res.status(405).json({ error: 'Method not allowed' });
};
