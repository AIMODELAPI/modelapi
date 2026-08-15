// ============================================================
// ModelAPI 配置文件
// 会员体系：登录 + 用量记录用 Supabase（publishable key 公开安全）
// ============================================================
window.APP_CONFIG = {
  // 登录方式: 'demo' (纯前端演示) | 'supabase' (真实)
  AUTH_MODE: 'supabase',
  // Supabase 公开配置（publishable key 设计上就是给前端用的，不算机密）
  SUPABASE_URL: 'https://leoubjkvyqyqsfxvmlbk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_vpkUnETUNsl3UCJ_PFkbKA_GSIgogDQ'
};