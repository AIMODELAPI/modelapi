// ============================================================
// Vercel Serverless Function · GET /api/harness/stats
// 返回 Harness 累计缓存统计（演示用，进程内存）
// 复用与本地相同的 Harness 核心引擎
// ============================================================
const core = require('../../harness-core');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json(core.getStats());
};
