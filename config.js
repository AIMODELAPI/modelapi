// ============================================================
// ModelAPI 配置文件
// 把下面这串换成你在 Clerk 后台拿到的 Publishable Key
// 格式类似：pk_test_xxxxxxxxxxxxxxxx 或 pk_live_xxxxxxxxxxxxxxxx
// 获取位置：Clerk 后台 → API Keys → Publishable key
// （这个 Key 是公开可见的，可以放心放在前端；真正保密的是 Secret Key，不要放进来）
// ============================================================
window.APP_CONFIG = {
  CLERK_PUBLISHABLE_KEY: 'REPLACE_WITH_YOUR_CLERK_PUBLISHABLE_KEY'
};
