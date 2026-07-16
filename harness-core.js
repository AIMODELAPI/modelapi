// ============================================================
// ModelAPI · Harness 智能缓存 + 计费引擎（零依赖，Node 22 全局 fetch）
// 被本地 server.js 与 Vercel serverless api/chat.js 共用
//
// 合规说明：本引擎是「官方授权 AI 网关」的缓存中间件样本实现。
// 仅做上下文复用 / Prompt 缓存匹配 / 去重，不做任何违规中转或转售。
// ============================================================
const crypto = require('crypto');

// 模型定价表（USD / 1M tokens）—— 示意性数据，真实价格以各厂商官方为准
const MODELS = {
  'gpt-4o-mini':      { label: 'GPT-4o mini',       vendor: 'OpenAI',    in: 0.15, out: 0.60, ctx: 128000 },
  'gpt-4o':           { label: 'GPT-4o',            vendor: 'OpenAI',    in: 2.50, out: 10.00, ctx: 128000 },
  'claude-3.5-sonnet':{ label: 'Claude 3.5 Sonnet', vendor: 'Anthropic', in: 3.00, out: 15.00, ctx: 200000 },
  'deepseek-chat':    { label: 'DeepSeek Chat',     vendor: 'DeepSeek',  in: 0.27, out: 1.10, ctx: 64000 },
  'qwen-max':         { label: 'Qwen Max',          vendor: 'Alibaba',   in: 1.60, out: 4.00, ctx: 32000 },
  'llama-3.1-70b':    { label: 'Llama 3.1 70B',     vendor: 'Meta',      in: 0.59, out: 0.79, ctx: 128000 },
};

// Prompt 缓存命中部分计费折扣（参考主流厂商 prompt cache：命中部分约 1 折）
const CACHE_DISCOUNT = 0.1;

// 进程内存缓存：key -> { content, ts }
const cache = new Map();

// 全局累计统计（演示用，进程内存；生产建议用 Redis 等外部存储）
const stats = {
  requests: 0,
  cacheHits: 0,
  totalPromptTokens: 0,
  totalCachedTokens: 0,
  totalBilledUsd: 0,
  totalLogicalUsd: 0,
};

function hashKey(model, system, userMsg) {
  const s = JSON.stringify({ m: model, s: system || '', u: userMsg || '' });
  return crypto.createHash('sha256').update(s).digest('hex');
}

// 粗略 token 估算：中文 ~1.5 字/token，英文 ~4 字符/token
function estimateTokens(text) {
  if (!text) return 0;
  const cn = (text.match(/[一-龥]/g) || []).length;
  const en = text.length - cn;
  return Math.max(1, Math.round(cn / 1.5 + en / 4));
}

function priceOf(model) {
  return MODELS[model] || MODELS['gpt-4o-mini'];
}

function getModels() {
  return Object.entries(MODELS).map(([id, m]) => ({
    id, label: m.label, vendor: m.vendor, ctx: m.ctx,
    price: { in: m.in, out: m.out },
  }));
}

function getStats() {
  const hitRate = stats.requests ? stats.cacheHits / stats.requests : 0;
  const mult = stats.totalBilledUsd > 0 ? stats.totalLogicalUsd / stats.totalBilledUsd : 1;
  return Object.assign({}, stats, { hit_rate: hitRate, effective_multiplier: mult });
}

// 调用上游（OpenAI 兼容）。无密钥则进入演示仿真模式。
async function callUpstream(body, env, model) {
  const baseUrl = (env && env.UPSTREAM_BASE_URL) || (body.upstream && body.upstream.baseUrl);
  const apiKey = (env && env.UPSTREAM_API_KEY) || body.apiKey;
  if (baseUrl && apiKey) {
    const res = await fetch(baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: body.temperature != null ? body.temperature : 0.7,
        max_tokens: body.max_tokens != null ? body.max_tokens : 512,
      }),
    });
    if (!res.ok) throw new Error('Upstream ' + res.status);
    const data = await res.json();
    const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    const u = data.usage || {};
    return {
      content,
      promptTokens: u.prompt_tokens || estimateTokens(JSON.stringify(body.messages)),
      completionTokens: u.completion_tokens || estimateTokens(content),
    };
  }
  return demoResponse(body, model);
}

// 演示仿真回复（无真实密钥时）
function demoResponse(body, model) {
  const userMsg = ((body.messages || []).filter(m => m.role === 'user').pop() || {}).content || '你好';
  const content =
    '[Harness 演示模式] 已通过 ModelAPI 统一端点调度 ' + priceOf(model).label + '。\n\n' +
    '你的问题是：「' + userMsg + '」\n\n' +
    '这是一段仿真回复，用于展示 API 调用与 Harness 缓存效果。' +
    '配置真实上游密钥（UPSTREAM_API_KEY）后，这里会返回模型真实输出。';
  return {
    content,
    promptTokens: estimateTokens(JSON.stringify(body.messages)),
    completionTokens: estimateTokens(content),
  };
}

// 处理一次对话请求
async function handleChat(body, env) {
  body = body || {};
  const model = (body.model && MODELS[body.model]) ? body.model : 'gpt-4o-mini';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = (messages.find(m => m.role === 'system') || {}).content || '';
  const userMsg = (messages.filter(m => m.role === 'user').pop() || {}).content || '';
  const useHarness = body.useHarness !== false; // 默认开启

  const key = hashKey(model, system, userMsg);
  const pricing = priceOf(model);

  stats.requests++;

  let content, cacheHit = false, cachedTokens = 0, promptTokens = 0, completionTokens = 0;

  if (useHarness && cache.has(key)) {
    // 缓存命中：prompt 直接复用（按 1 折计费），completion 从缓存取（零费用）
    cacheHit = true;
    stats.cacheHits++;
    content = cache.get(key).content;
    promptTokens = estimateTokens(system + '\n' + userMsg);
    cachedTokens = promptTokens;
    completionTokens = estimateTokens(content);
  } else {
    // 缓存未命中：调用上游
    const upstream = await callUpstream(body, env, model);
    content = upstream.content;
    promptTokens = upstream.promptTokens;
    completionTokens = upstream.completionTokens;
    if (useHarness) cache.set(key, { content, ts: Date.now() });
  }

  // 计费（USD）
  let billedUsd, logicalUsd;
  if (cacheHit) {
    logicalUsd = (promptTokens / 1e6) * pricing.in + (completionTokens / 1e6) * pricing.out;
    billedUsd = (cachedTokens / 1e6) * pricing.in * CACHE_DISCOUNT; // completion 取自缓存，0 费用
  } else {
    logicalUsd = billedUsd = (promptTokens / 1e6) * pricing.in + (completionTokens / 1e6) * pricing.out;
  }

  stats.totalPromptTokens += promptTokens;
  stats.totalCachedTokens += cachedTokens;
  stats.totalBilledUsd += billedUsd;
  stats.totalLogicalUsd += logicalUsd;

  const hitRate = stats.requests ? stats.cacheHits / stats.requests : 0;
  const effectiveMultiplier = stats.totalBilledUsd > 0 ? stats.totalLogicalUsd / stats.totalBilledUsd : 1;

  return {
    id: 'chatcmpl-' + crypto.randomBytes(6).toString('hex'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
      total_tokens: promptTokens + completionTokens,
    },
    cost_usd: Number(billedUsd.toFixed(6)),
    harness: {
      enabled: useHarness,
      cache_hit: cacheHit,
      hit_rate: Number(hitRate.toFixed(4)),
      effective_multiplier: Number(effectiveMultiplier.toFixed(2)),
      saved_usd: Number((logicalUsd - billedUsd).toFixed(6)),
    },
  };
}

module.exports = { MODELS, handleChat, getModels, getStats, CACHE_DISCOUNT };
