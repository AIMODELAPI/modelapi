// ============================================================
// Vercel Serverless Function · GET /api/models
// 返回可用模型与价格（被 Playground 模型下拉框使用）
// 复用与本地相同的 Harness 核心引擎
// ============================================================
const core = require('../harness-core');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ models: core.getModels() });
};
