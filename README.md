# Gitpan ☁️

**Gitpan** 是一个可以部署在 **Cloudflare Workers** 上的私人网盘，以你自己的 **GitHub 私有仓库**作为存储后端 —— 不需要任何数据库、对象存储或第三方网盘服务，只需要一个 Cloudflare 账号 + 一个 GitHub 仓库。

- 🚀 全部请求由单个 Cloudflare Worker 处理，全球边缘节点响应，速度快
- 📦 上传 / 下载全部使用**流式转发**，Worker 不缓冲文件内容，不会触发 Cloudflare 1102（CPU/内存超限）错误
- 📊 上传时实时显示进度、速度、剩余时间
- 🔑 通过环境变量设置访问密码，未登录无法访问网盘内容
- 🔗 文件/文件夹分享链接，可选独立密码 + 有效期
- 👀 支持在线预览图片、视频、音频、PDF、文本/代码等常见格式
- 📁 新建文件夹、重命名、移动、批量删除、拖拽上传（文件/文件夹）
- 🎨 简洁美观的现代化界面（React + Tailwind CSS）

---

## 目录

- [工作原理](#工作原理)
- [部署前准备](#部署前准备)
- [部署步骤](#部署步骤)
- [环境变量说明](#环境变量说明)
- [本地开发](#本地开发)
- [已知限制](#已知限制)
- [安全说明](#安全说明)
- [技术栈](#技术栈)

---

## 工作原理

```
浏览器 (React 前端)
   │
   │  1. 输入访问密码登录 → Worker 签发会话 Cookie
   │  2. 浏览器把文件在本地分块 Base64 编码，拼装成
   │     GitHub Contents API 需要的 JSON 请求体（Blob 形式，不占大量内存）
   │  3. 用 XHR PUT 把这个 Blob 发给 Worker（可实时获取上传进度/速度）
   ▼
Cloudflare Worker (worker/index.js)
   │  只做“透传”：校验会话后，把请求体原样 pipe 给 GitHub API，
   │  全程不把文件内容读入内存，因此不会触发 Worker 1102 报错
   ▼
GitHub REST / Git Data API
   │  写入你的私有仓库（Contents API 创建/更新文件，
   │  Git Data API 做高效的批量重命名/移动/删除）
   ▼
你的 GitHub 私有仓库 = 你的网盘存储空间
```

下载 / 分享下载同理：Worker 向 GitHub 请求文件的原始字节（`Accept: application/vnd.github.raw`），并将响应流直接透传给浏览器，全程不落盘、不缓冲。

文件夹下载会在浏览器端使用 [`client-zip`](https://github.com/Touffy/client-zip) 边下载边打包成 zip，Worker 侧同样只是把每个文件流式转发，不会在 Worker 里生成 zip。

## 部署前准备

1. **一个 GitHub 账号** 和一个**私有仓库**（用来存放你的网盘文件），例如 `yourname/my-drive`。
2. **一个 GitHub Token**（推荐使用 [Fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)）：
   - Repository access：选择上面创建的私有仓库
   - Permissions → Contents：**Read and write**
3. **一个 Cloudflare 账号**，并安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)：
   ```bash
   npm install -g wrangler
   wrangler login
   ```

## 部署步骤

1. **克隆本项目并安装依赖**

   ```bash
   git clone <你的项目地址> gitpan
   cd gitpan
   npm install
   ```

2. **修改 `wrangler.toml`**，把 `GITHUB_REPO` 改成你自己的 `owner/repo`（分支名默认为 `main`，如需其他分支改 `GITHUB_BRANCH`）：

   ```toml
   [vars]
   GITHUB_REPO = "yourname/my-drive"
   GITHUB_BRANCH = "main"
   ```

3. **配置密钥**（不要把 Token/密码写进 `wrangler.toml` 提交到仓库，使用 Wrangler Secrets）：

   ```bash
   wrangler secret put GITHUB_TOKEN
   # 粘贴你的 GitHub Token

   wrangler secret put ACCESS_PASSWORD
   # 设置访问网盘所需要的密码

   wrangler secret put SESSION_SECRET
   # 任意一串随机字符串，用于签名登录会话（可用: openssl rand -hex 32）
   ```

4. **构建前端并部署 Worker**

   ```bash
   npm run build
   wrangler deploy
   ```

   部署完成后，Wrangler 会输出一个形如 `https://gitpan.<your-subdomain>.workers.dev` 的地址，这就是你的网盘入口。

5. 打开该地址，输入你设置的 `ACCESS_PASSWORD` 即可登录使用。

> 💡 如果你想绑定自定义域名，在 Cloudflare Dashboard 的 Workers → 你的 Worker → Settings → Triggers 中添加自定义域即可。

### 更新部署

以后每次修改代码，只需要重新执行：

```bash
npm run build && wrangler deploy
```

## 环境变量说明

| 变量 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Secret | 是 | GitHub Token，需要对目标仓库有 Contents 读写权限 |
| `GITHUB_REPO` | Var | 是 | 存储网盘文件的私有仓库，格式 `owner/repo` |
| `GITHUB_BRANCH` | Var | 否 | 使用的分支，默认 `main` |
| `ACCESS_PASSWORD` | Secret | 是 | 访问网盘所需的密码 |
| `SESSION_SECRET` | Secret | 建议设置 | 用于签名登录 Cookie 的随机密钥，不设置时会退化为基于其他密钥派生（安全性较弱） |

`Var` 类型可以直接写在 `wrangler.toml` 的 `[vars]` 中；`Secret` 类型强烈建议用 `wrangler secret put` 命令设置，避免明文出现在代码仓库里。

## 本地开发

本项目前端使用 Vite + React，后端是独立的 Worker 脚本（`worker/index.js`），二者在本地开发时分别运行：

```bash
# 终端 1：前端热更新
npm run dev

# 终端 2：本地运行 Worker（需要先在 wrangler.toml 同级目录创建 .dev.vars 文件）
wrangler dev
```

`.dev.vars` 示例（本地开发专用，不要提交到仓库）：

```
GITHUB_TOKEN=ghp_xxx
ACCESS_PASSWORD=123456
SESSION_SECRET=dev-secret
```

由于前后端本地跑在不同端口，建议直接用 `npm run build && wrangler dev` 联调（Wrangler 会同时启动 Worker 与静态资源服务），体验和线上一致。

## 已知限制

- **单文件大小**：受 GitHub Contents/Git Data API 本身限制，单个文件最大 **100 MB**；这是 GitHub 的限制，并非 Cloudflare Worker 的限制（Worker 侧全程流式转发，不缓冲文件，因此不会出现 1102 报错）。同时 Cloudflare 对单次请求体大小也有平台级上限（免费版 100MB，付费版可更高），实际以两者较小值为准。
- **超大文件夹打包下载**：文件夹下载在浏览器端边下载边压缩为 zip，压缩后的内容会保存在浏览器内存中再触发保存，非常大的文件夹（几 GB 以上）可能受限于浏览器可用内存。
- 空文件夹在 Git 中不会被跟踪，新建文件夹时会自动放入一个隐藏的 `.gitkeep` 文件。
- 分享记录保存在仓库内的 `.gitpan/shares.json` 文件中，请勿手动删除/编辑该文件。

## 安全说明

- 所有页面（除已生成的分享链接外）都必须先输入 `ACCESS_PASSWORD` 登录，登录状态通过签名 + 过期时间的 HttpOnly Cookie 维护，GitHub Token 全程只保存在 Worker 环境变量中，从不下发到浏览器。
- 分享链接的密码只在服务端保存 SHA-256 哈希，不落地明文。
- 建议为 `SESSION_SECRET` 设置一个足够随机的值，并定期更换 `ACCESS_PASSWORD`。

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS + React Router + lucide-react 图标 + client-zip
- 后端：Cloudflare Workers（原生 Fetch API，无框架依赖）+ GitHub REST API / Git Data API
- 存储：你自己的 GitHub 私有仓库

---

祝使用愉快！如果 Gitpan 帮到了你，欢迎 Star ⭐ 本项目。
