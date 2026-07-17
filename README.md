# AIModelAPI 赛博朋克版 Demo · 部署与上线说明

这是一个**可直接上网访问**的 AIModelAPI 官网 Demo（赛博朋克风格），包含：
- 官网静态页面（首页 / 定价 / 为什么选 / FAQ / 登录）
- **真实可调用的后端原型**：一个统一端点，调用 100+ 模型，并内置 **Harness 智能缓存引擎**
- **Playground 调用控制台** 与 **Harness 1美元=5美元 说明页**

本文件夹就是要推到 GitHub 的内容，结构如下：

```
deploy-cyberpunk/
├── index.html          首页（含 Playground 入口）
├── pricing.html        定价（已去除 USDT，仅保留"不接收加密货币"声明）
├── why-modelapi.html   为什么选 AIModelAPI（无公司法定名）
├── faq.html            FAQ（中/英/日/韩 四语切换）
├── login.html          登录页（纯前端演示登录）
├── playground.html     ★ API 调用控制台（你要的"调用端口"）
├── harness.html        ★ Harness 1美元=5美元 说明 + 交互模拟器
├── auth.js             登录守卫（localStorage 演示态）
├── config.js           前端配置（登录方式等）
├── modelapi-demo.css   共享样式
├── server.js           ★ 本地后端服务器（零依赖 Node）
├── harness-core.js     ★ Harness 缓存 + 计费引擎（本地与 Vercel 共用）
├── api/chat.js         ★ Vercel Serverless 函数（POST /api/chat）
├── vercel.json         Vercel 部署配置
├── .env.example        后端环境变量示例
└── README.md           本说明
```

> 合规提醒：全站不含"中转站/代理/Reseller/转售"等禁用词。Harness 仅做 **官方授权 AI 网关的上下文缓存复用**，有利于过 Airwallex / Stripe 审核。

---

## 一、本地运行（看真实效果，推荐）

本机需要 Node.js（已用 22.x 验证）。在 `deploy-cyberpunk/` 目录打开命令行：

```bash
node server.js
```

然后浏览器打开 **http://localhost:3000** 即可。
- 不配置密钥也能跑：未填上游密钥时自动进入「演示仿真模式」，返回仿真回复，但**缓存与计费逻辑是真实的**。
- 配置真实模型：复制 `.env.example` 为 `.env`，填入 `UPSTREAM_BASE_URL` 与 `UPSTREAM_API_KEY`，再 `node server.js`，即可真正调度模型。

打开 `playground.html`，在「用户消息」里输入内容 → 点「发送请求」；再点「再发一次（测缓存）」发相同内容，右侧会显示 **缓存命中、本次花费归零、效率倍率上升**。

---

## 二、部署上线（Vercel，你之前确认的平台）

代码仍放在 GitHub，由 Vercel 拉取并生成可访问网址（自带 HTTPS + CDN）。

### 第 1 步：在 GitHub 建一个空仓库
1. 登录 https://github.com ，右上角 **+** → **New repository**。
2. 仓库名建议：`modelapi`。
3. 选 **Public**。
4. **不要**勾选 "Initialize with a README"。
5. 点 **Create repository**，把仓库地址（`https://github.com/你的用户名/modelapi.git`）发我，我帮你 `git push`。

### 第 2 步：在 Vercel 导入仓库（网页操作，无需命令行）
1. 打开 https://vercel.com ，用 GitHub 登录并授权。
2. **Add New** → **Project** → 选中刚才的 `modelapi` 仓库 → **Import**。
3. Framework Preset 选 **Other**（无需构建，纯静态 + Serverless）。
4. （可选）**Environment Variables** 里加 `UPSTREAM_BASE_URL` 和 `UPSTREAM_API_KEY`，让线上也调真实模型。
5. 点 **Deploy**，几十秒后给出网址，形如 `https://modelapi.vercel.app`。

### 第 3 步：把网址发给老板
部署后任何改动只要 `git push`，Vercel 会自动重新发布。

---

## 三、API 接口说明（你要的"调用端口"）

统一端点（上线后即为你的域名）：

```
POST https://你的域名/api/chat        # 对话调用（被 Playground 使用）
GET  https://你的域名/api/models      # 可用模型与价格
GET  https://你的域名/api/harness/stats  # Harness 累计缓存统计
```

`POST /api/chat` 请求体（OpenAI 兼容）：

```json
{
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "你好" }],
  "useHarness": true
}
```

返回示例（含 Harness 统计）：

```json
{
  "usage": { "prompt_tokens": 5, "completion_tokens": 62, "cached_tokens": 5 },
  "cost_usd": 0,
  "harness": {
    "cache_hit": true,
    "hit_rate": 0.5,
    "effective_multiplier": 1.97,
    "saved_usd": 0.000038
  }
}
```

---

## 四、Harness 为什么能让 1 美元 ≈ 5 美元

Harness 是网关层的一层智能缓存中间件，在请求到达模型前完成 **缓存匹配 + 上下文复用**：
- 相同 / 相似请求第二次进来，**prompt 按 1 折计费**，completion 直接复用（零费用）；
- 命中率越高，等效倍率越高；**满命中场景下约 5 倍**（即每花 1 美元，获得约 5 美元的实际使用价值）。
- `harness.html` 页内有可拖动滑块，输入"月支出 + 命中率"即可算出等效价值与月省金额。

---

## 备注
- 登录是**纯前端演示登录**（localStorage），无需外部服务；如要真实账号体系，把 `config.js` 的 `AUTH_MODE` 切到 `clerk` / `auth0` 并填密钥即可。
- 后端为**进程内存缓存**，演示足够；生产建议把缓存换为 Redis / Upstash 等外部存储（Vercel 上可用 Upstash）。
- 本文件夹是独立副本，原始赛博朋克 Demo 与苹果风 Demo 均未被改动。
