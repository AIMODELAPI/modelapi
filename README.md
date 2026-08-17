# ModelAPI · AI 生图与视频生成平台

这是一个**专注 AI 生图与 AI 视频生成**的网站（域名 `aimodelapi.top`），底层 AI 能力由 `aimodelapi.ai` 平台驱动。

技术栈：**纯 HTML + Vercel Serverless 函数（零依赖 Node 22）**，代码托管在 GitHub，由 Vercel 自动部署。

## 功能一览

- **AI 生图**（`image.html` + `api/image.js`）：输入一句话，生成 1:1 / 16:9 / 9:16 的高质量图片，底层模型通义万相 Wan 2.7。
- **AI 视频**（`video.html` + `api/video.js`）：输入一句话，生成 3 / 5 / 10 秒、480P / 720P 的视频，底层模型通义万相 Wan 2.7。
- **会员体系**（`login.html` + `dashboard.html`）：Supabase 真实注册 / 登录，生图自动记录用量，可在「我的用量」页查看历史。
- **合规页面**（KYB 审核用）：隐私政策、服务条款、关于我们、联系我们。

## 目录结构

```
├── index.html           首页（AI 生图 + 视频简介）
├── image.html           AI 生图页面
├── video.html           AI 视频页面
├── login.html           登录 / 注册（Supabase）
├── dashboard.html       我的用量（历史记录）
├── about.html           关于我们（KYB）
├── privacy.html         隐私政策（KYB）
├── terms.html           服务条款（KYB）
├── contact.html         联系我们（KYB）
├── config.js            前端配置（Supabase 公开配置）
├── modelapi-demo.css    全站共享样式
├── server.js            本地开发服务器（零依赖 Node）
├── api/image.js         Vercel 函数：POST /api/image（生图）
├── api/video.js         Vercel 函数：POST /api/video（视频）
├── vercel.json          Vercel 部署配置
├── .env.example         后端环境变量示例
└── README.md            本说明
```

## 一、本地运行

本机需要 Node.js（22.x）。在本目录打开命令行：

```bash
node server.js
```

浏览器打开 **http://localhost:3000**。

- 不配置密钥也能跑：未配置 `IMAGE_API_KEY` 时生图进入「演示模式」；未配置 `VIDEO_API_KEY` 时视频进入「对接中」提示。
- 配置真实密钥：复制 `.env.example` 为 `.env`，填入 `IMAGE_API_KEY` / `VIDEO_API_KEY`，再 `node server.js`。

## 二、部署上线（Vercel）

代码在 GitHub，由 Vercel 拉取并生成可访问网址。任何 `git push` 到 master 后 Vercel 会自动重新发布。

需要在 Vercel 项目 **Settings → Environment Variables** 配置：

| 变量名 | 说明 |
| --- | --- |
| `IMAGE_API_KEY` | 生图平台密钥（来自 aimodelapi.ai，已配置，生图已上线） |
| `IMAGE_BASE_URL` | 默认 `https://api.aimodelapi.ai/v1` |
| `VIDEO_API_KEY` | 视频平台密钥（接口确认后配置） |
| `VIDEO_BASE_URL` | 默认 `https://api.aimodelapi.ai/v1`（和生图共用主节点） |

> Supabase 的 URL + publishable key 直接硬编码在 `config.js`（publishable key 设计上就是公开的），无需在 Vercel 配环境变量。

## 三、API 接口

```
POST /api/image           生图：{ prompt, size, n } → 返回图片 URL
POST /api/video           提交视频任务：{ prompt, duration, resolution } → 返回 { task_id }
GET  /api/video?task_id=  查询视频任务 → 返回 { status, video_url }（前端每 5 秒轮询）
GET  /api/health          健康检查
```

## 备注

- 登录 / 用量记录走 Supabase（表 `gen_logs`），生图成功后自动写入，未登录则跳过。
- 视频生成走 aimodelapi.ai 的异步任务接口：提交 `POST /v1/contents/generations/tasks` 拿 `task_id`，再 `GET /v1/contents/generations/tasks/{id}` 轮询结果。模型 `WAN-t2v-2.7`，分辨率 `720P`/`1080P`。
- 主体信息（公司名 / 注册地 / 注册号 / 地址 / 邮箱）在 `about.html`、`contact.html` 等页面以 `[占位符]` 形式保留，KYB 审核前需填入真实信息。
