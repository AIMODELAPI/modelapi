// ============================================================
// ModelAPI 登录守卫（基于 Clerk 的真实账号系统）
// 依赖：config.js（提供密钥） + Clerk 官方 CDN 脚本
// 作用：
//   1. 加载 Clerk，识别当前登录用户
//   2. 在导航栏右上角显示「登录」或「邮箱 + 登出」
//   3. 想强制"未登录不能看网站"？见文件底部注释
// ============================================================
(function () {
  var KEY = (window.APP_CONFIG && window.APP_CONFIG.CLERK_PUBLISHABLE_KEY) || '';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderNav() {
    var navAuth = document.getElementById('nav-auth');
    var cta = document.getElementById('navCta');
    if (!navAuth) return;
    if (window.Clerk && window.Clerk.user) {
      var email = (window.Clerk.user.primaryEmailAddress &&
                   window.Clerk.user.primaryEmailAddress.emailAddress) ||
                  window.Clerk.user.username || '用户';
      navAuth.innerHTML =
        '<span class="nav-user">' + escapeHtml(email) + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="logoutBtn">登出</button>';
      var lb = document.getElementById('logoutBtn');
      if (lb) lb.addEventListener('click', function () {
        window.Clerk.signOut().then(function () { window.location.href = 'index.html'; });
      });
      if (cta) { cta.textContent = '控制台'; cta.setAttribute('href', 'login.html'); }
    } else {
      navAuth.innerHTML = '<a class="nav-login" href="login.html">登录</a>';
    }
  }

  function boot() {
    if (!window.Clerk) {
      console.error('[auth] Clerk 未加载，请检查 CDN 或网络');
      return;
    }
    if (!KEY || KEY.indexOf('REPLACE_') === 0) {
      console.warn('[auth] 尚未配置 Clerk Publishable Key，登录功能暂不可用。请在 config.js 中填写。');
      renderNav();
      return;
    }
    window.Clerk.load({ publishableKey: KEY }).then(function () {
      renderNav();
      if (typeof window.Clerk.addListener === 'function') {
        window.Clerk.addListener(function () { renderNav(); });
      }
      // ── 想强制「未登录不能看任何页面」？把下面这行取消注释即可 ──
      // if (!window.Clerk.user) window.location.href = 'login.html';
    }).catch(function (e) {
      console.error('[auth] Clerk 加载失败：', e);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
