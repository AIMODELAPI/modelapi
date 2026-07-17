// ============================================================
// AIModelAPI 登录守卫（纯前端演示版）
// 无需任何外部服务 / 无需 CDN / 无需密钥配置
// 登录态存储在浏览器 localStorage 中
//
// 功能：
//   1. 检测登录态 → 导航栏显示「邮箱 + 登出」或「登录」
//   2. 点击「登出」清除状态并刷新页面
//   3. 点击「免费开始 / 控制台」→ 未登录则跳转 login.html
// ============================================================
(function () {

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('modelapi_user') || 'null'); }
    catch (_){ return null; }
  }

  function renderNav() {
    var navAuth = document.getElementById('nav-auth');
    var cta = document.getElementById('navCta');
    if (!navAuth) return;

    var user = getUser();

    if (user && user.email) {
      // 已登录：显示邮箱缩写 + 登出按钮
      var name = user.name || user.email.split('@')[0] || '用户';
      navAuth.innerHTML =
        '<span class="nav-user">' + escapeHtml(name) + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="logoutBtn">登出</button>';
      var lb = document.getElementById('logoutBtn');
      if (lb) lb.addEventListener('click', function () {
        localStorage.removeItem('modelapi_user');
        window.location.href = 'login.html';
      });
      if (cta) { cta.textContent = '控制台'; cta.setAttribute('href', '#'); }
    } else {
      // 未登录：显示「登录」按钮
      navAuth.innerHTML = '<a class="nav-login" href="login.html">登录</a>';
      if (cta) cta.setAttribute('href', 'login.html');
    }
  }

  // 页面加载完成后渲染
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNav);
  } else {
    renderNav();
  }

})();
