import {
  sanitizePath,
  joinPath,
  sha256Hex,
  signToken,
  verifyToken,
  getCookie,
  setCookie,
  repoInfo,
  listDir,
  getFileMeta,
  downloadRaw,
  ensureFolder,
  deletePaths,
  movePaths,
  listAllFilesUnder,
  readShares,
  writeShares,
} from "./lib.js";

const SESSION_COOKIE = "gitpan_session";
const SHARE_COOKIE_PREFIX = "gitpan_share_";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

function error(message, status = 400) {
  return json({ error: message }, { status });
}

function guessContentType(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    json: "application/json; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    ts: "text/plain; charset=utf-8",
    css: "text/css; charset=utf-8",
    html: "text/html; charset=utf-8",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

async function requireSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  const payload = await verifyToken(env, token);
  if (!payload || payload.scope !== "main") return null;
  return payload;
}

async function requireShareAccess(request, env, share) {
  if (!share.passwordHash) return true;
  const token = getCookie(request, SHARE_COOKIE_PREFIX + share.id);
  const payload = await verifyToken(env, token);
  return !!(payload && payload.scope === "share" && payload.id === share.id);
}

function isExpired(share) {
  return share.expiresAt && Date.now() > share.expiresAt;
}

async function findShare(env, id) {
  const { list } = await readShares(env);
  return list.find((s) => s.id === id) || null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname.startsWith("/api/")) {
        const res = await handleApi(request, env, url);
        if (res) return res;
        return error("Not found", 404);
      }
    } catch (err) {
      console.error(err);
      return error(err.message || "Internal error", err.status || 500);
    }

    // Static assets (built frontend) — SPA fallback handled by assets config.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.ACCESS_PASSWORD) {
    return error(
      "Worker 尚未正确配置环境变量 (GITHUB_TOKEN / GITHUB_REPO / ACCESS_PASSWORD)",
      500
    );
  }

  /* ---------------- auth ---------------- */
  if (pathname === "/api/login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body.password !== env.ACCESS_PASSWORD) {
      return error("密码错误", 401);
    }
    const token = await signToken(env, { scope: "main" }, SESSION_TTL);
    return json(
      { ok: true },
      { headers: { "Set-Cookie": setCookie(SESSION_COOKIE, token, SESSION_TTL) } }
    );
  }

  if (pathname === "/api/logout" && method === "POST") {
    return json({ ok: true }, { headers: { "Set-Cookie": setCookie(SESSION_COOKIE, "", 0) } });
  }

  if (pathname === "/api/session" && method === "GET") {
    const session = await requireSession(request, env);
    return json({ authenticated: !!session, repo: env.GITHUB_REPO, branch: repoInfo(env).branch });
  }

  /* ---------------- public share endpoints ---------------- */
  if (pathname.startsWith("/api/s/")) {
    return handleShareApi(request, env, url);
  }

  /* ---------------- everything below requires main session ---------------- */
  const session = await requireSession(request, env);
  if (!session) return error("未登录或登录已过期", 401);

  if (pathname === "/api/list" && method === "GET") {
    const path = sanitizePath(url.searchParams.get("path"));
    const items = await listDir(env, path);
    return json({ path, items });
  }

  if (pathname === "/api/tree" && method === "GET") {
    const path = sanitizePath(url.searchParams.get("path"));
    const files = await listAllFilesUnder(env, path);
    return json({ path, files });
  }

  if (pathname === "/api/mkdir" && method === "POST") {
    const body = await request.json();
    const path = sanitizePath(joinPath(sanitizePath(body.parent || ""), body.name));
    if (!path) return error("文件夹名称不能为空");
    await ensureFolder(env, path);
    return json({ ok: true, path });
  }

  if (pathname === "/api/upload" && (method === "PUT" || method === "POST")) {
    const path = sanitizePath(url.searchParams.get("path"));
    if (!path) return error("缺少目标路径");
    const { owner, repo } = repoInfo(env);
    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const headers = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "Gitpan-Worker",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    const contentLength = request.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    // Pure streaming pass-through: the browser has already built the exact GitHub
    // Contents-API JSON payload (base64 content streamed in), so the Worker never
    // has to buffer the file in memory — this is what avoids error 1102.
    const ghResp = await fetch(ghUrl, {
      method: "PUT",
      headers,
      body: request.body,
      duplex: "half",
    });
    const text = await ghResp.text();
    if (!ghResp.ok) return error(`GitHub 上传失败: ${text}`, ghResp.status);
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {}
    return json({ ok: true, sha: data.content && data.content.sha });
  }

  if (pathname === "/api/download" && method === "GET") {
    const path = sanitizePath(url.searchParams.get("path"));
    const meta = await getFileMeta(env, path);
    const resp = await downloadRaw(env, path);
    if (!resp.ok) return error("文件不存在或下载失败", resp.status);
    const name = path.split("/").pop();
    const headers = {
      "Content-Type": guessContentType(name),
      "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
    };
    const len = resp.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    else if (meta && meta.size) headers["Content-Length"] = String(meta.size);
    return new Response(resp.body, { headers });
  }

  if (pathname === "/api/delete" && method === "POST") {
    const body = await request.json();
    const paths = (body.paths || []).map(sanitizePath).filter(Boolean);
    if (!paths.length) return error("未选择要删除的项目");
    await deletePaths(env, paths);
    return json({ ok: true });
  }

  if (pathname === "/api/rename" && method === "POST") {
    const body = await request.json();
    const path = sanitizePath(body.path);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const newPath = sanitizePath(joinPath(parent, body.newName));
    if (!path || !newPath) return error("参数错误");
    await movePaths(env, [{ from: path, to: newPath }]);
    return json({ ok: true, path: newPath });
  }

  if (pathname === "/api/move" && method === "POST") {
    const body = await request.json();
    const destDir = sanitizePath(body.destDir || "");
    const paths = (body.paths || []).map(sanitizePath).filter(Boolean);
    if (!paths.length) return error("未选择要移动的项目");
    const moves = paths.map((p) => {
      const name = p.split("/").pop();
      return { from: p, to: sanitizePath(joinPath(destDir, name)) };
    });
    await movePaths(env, moves);
    return json({ ok: true });
  }

  /* ---------------- share management (owner side) ---------------- */
  if (pathname === "/api/shares" && method === "GET") {
    const { list } = await readShares(env);
    return json({ shares: list });
  }

  if (pathname === "/api/shares" && method === "POST") {
    const body = await request.json();
    const path = sanitizePath(body.path);
    if (!path) return error("路径不能为空");
    const { list, sha } = await readShares(env);
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const record = {
      id,
      path,
      name: path.split("/").pop() || path,
      type: body.type === "dir" ? "dir" : "file",
      passwordHash: body.password ? await sha256Hex(body.password) : null,
      createdAt: Date.now(),
      expiresAt: body.expiresInDays ? Date.now() + body.expiresInDays * 86400000 : null,
    };
    list.push(record);
    await writeShares(env, list, sha);
    return json({ ok: true, share: record });
  }

  if (pathname.startsWith("/api/shares/") && method === "DELETE") {
    const id = pathname.split("/").pop();
    const { list, sha } = await readShares(env);
    const next = list.filter((s) => s.id !== id);
    await writeShares(env, next, sha);
    return json({ ok: true });
  }

  return null;
}

async function handleShareApi(request, env, url) {
  const method = request.method;
  const parts = url.pathname.split("/").filter(Boolean); // ["api","s",":id", ...rest]
  const id = parts[2];
  if (!id) return error("Not found", 404);
  const share = await findShare(env, id);
  if (!share || isExpired(share)) return error("分享不存在或已过期", 404);
  const sub = parts.slice(3).join("/");

  if (sub === "" && method === "GET") {
    return json({
      id: share.id,
      name: share.name,
      type: share.type,
      requiresPassword: !!share.passwordHash,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    });
  }

  if (sub === "verify" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!share.passwordHash) return json({ ok: true });
    const hash = await sha256Hex(body.password || "");
    if (hash !== share.passwordHash) return error("密码错误", 401);
    const token = await signToken(env, { scope: "share", id: share.id }, 60 * 60 * 12);
    return json(
      { ok: true },
      { headers: { "Set-Cookie": setCookie(SHARE_COOKIE_PREFIX + share.id, token, 60 * 60 * 12) } }
    );
  }

  const allowed = await requireShareAccess(request, env, share);
  if (!allowed) return error("需要密码", 401);

  if (sub === "list" && method === "GET") {
    if (share.type !== "dir") return error("该分享不是文件夹", 400);
    const rel = sanitizePath(url.searchParams.get("path") || "");
    const full = sanitizePath(joinPath(share.path, rel));
    if (full !== share.path && !full.startsWith(share.path + "/")) return error("路径越界", 400);
    const items = (await listDir(env, full)).map((it) => ({
      ...it,
      path: rel ? `${rel}/${it.name}` : it.name,
    }));
    return json({ path: rel, items });
  }

  if (sub === "tree" && method === "GET") {
    const files = (await listAllFilesUnder(env, share.path)).map((f) => ({
      ...f,
      path: f.path.slice(share.path.length + 1),
    }));
    return json({ files });
  }

  if (sub === "download" && method === "GET") {
    let target = share.path;
    if (share.type === "dir") {
      const rel = sanitizePath(url.searchParams.get("path") || "");
      target = sanitizePath(joinPath(share.path, rel));
      if (target !== share.path && !target.startsWith(share.path + "/")) return error("路径越界", 400);
    }
    const meta = await getFileMeta(env, target);
    const resp = await downloadRaw(env, target);
    if (!resp.ok) return error("文件不存在或下载失败", resp.status);
    const name = target.split("/").pop();
    const headers = {
      "Content-Type": guessContentType(name),
      "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
    };
    const len = resp.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    else if (meta && meta.size) headers["Content-Length"] = String(meta.size);
    return new Response(resp.body, { headers });
  }

  return error("Not found", 404);
}
