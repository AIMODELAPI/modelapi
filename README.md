# ModelAPI 赛博朋克版 Demo · 部署与上线说明

这是一个**可直接上网访问**的 ModelAPI 官网 Demo（赛博朋克风格），已集成**真实登录系统**（基于 Clerk）。
本文件夹就是要推到 GitHub 的内容，结构如下：

```
deploy-cyberpunk/
├── index.html          首页
├── pricing.html        定价（已去除 USDT，仅保留"不接收加密货币"声明）
├── why-modelapi.html   为什么选 ModelAPI（无公司法定名）
├── faq.html            FAQ（中/英/日/韩 四语切换）
├── login.html          登录页（真实账号：邮箱注册/登录 + 社交登录）
├── auth.js             登录守卫（识别登录态、导航显示用户/登出）
├── config.js           ← 在这里填入你的 Clerk 密钥
├── modelapi-demo.css   共享样式
└── README.md           本说明
```

> 合规提醒：全站不含"中转站/代理/Reseller/转售"等禁用词，保留的是"我们不是中间商"的澄清表述，有利于过 Airwallex / Stripe 审核。

---

## 你只需要做三件事（都是点几下鼠标）

### 第 1 步：拿到 Clerk 密钥（真实登录靠它）
1. 打开 https://clerk.com ，用 GitHub 或邮箱注册。
2. 新建一个 Application，名字填 `ModelAPI`。
3. 进入左侧 **API Keys**，复制 **Publishable key**（长得像 `pk_test_xxxxx` 或 `pk_live_xxxxx`）。
4. 把这段 key 填进本文件夹里的 `config.js` 第 6 行：
   ```js
   CLERK_PUBLISHABLE_KEY: '这里换成你的 pk_...'
   ```
   （你也可以直接把 key 发给我，我帮你填好再推。）

### 第 2 步：在 GitHub 建一个空仓库
1. 登录 https://github.com （没有账号先注册一个）。
2. 右上角 **+** → **New repository**。
3. 仓库名建议：`modelapi`（最终网址会是 `https://你的用户名.github.io/modelapi`）。
4. 选 **Public**（Pages 免费需要 Public）。
5. **不要**勾选 "Initialize with a README"。
6. 点 **Create repository**，然后把出现的仓库地址（`https://github.com/你的用户名/modelapi.git`）发给我。

### 第 3 步：生成一个访问令牌（PAT）让我能推送
1. GitHub 右上角头像 → **Settings** → 左侧最下方 **Developer settings**。
2. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**。
3. Note 填 `modelapi-deploy`；Expiration 选比如 `30 days`。
4. 勾选 **repo**（把 repo 下面那一整项都勾上）。
5. 点 **Generate token**，复制那串 `ghp_xxxx`（**只显示一次，赶紧复制**）。
6. 把这段令牌发给我。

> 令牌等于你账号的临时钥匙，**只在这台机器、这次部署用**，用完可随时去 GitHub 撤销。

---

## 然后交给我
你把下面三样发我，我就把代码推上去、开启 GitHub Pages，并把你的 Pages 网址给你：
1. 第 2 步的仓库地址
2. 第 3 步的 PAT 令牌
3. （可选）Clerk 的 Publishable key（如果你没自己填进 config.js）

---

## 第 4 步（我推完之后你要做一件小事）
登录 Clerk 后台 → **Configure** → **Restrictions** → **Allowed origins**，把你的 Pages 网址加进去：
- `https://你的用户名.github.io`
- （如需本地预览）`http://localhost:3000`

不加这一步，登录组件会因为"域名不在白名单"而报错。

---

## 可选：先在本地看效果
在本文件夹打开命令行，运行：
```
python -m http.server 3000
```
浏览器打开 http://localhost:3000 即可预览（登录功能需先填好 Clerk key）。

---

## 备注
- 登录是**真登录**：用户在登录页注册/登录，密码由 Clerk 加密保管，你不用自己搭服务器。
- Clerk 有免费额度（约 1 万月活用户以内免费），普通 Demo / 给老板看完全够用。
- 想强制"不登录不能看网站"？打开 `auth.js`，把最下面注释掉的那行 `if (!window.Clerk.user) ...` 取消注释即可。
- 本文件夹是独立副本，原始赛博朋克 Demo 与苹果风 Demo 均未被改动。
