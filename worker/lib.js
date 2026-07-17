/**
 * Gitpan worker helper library
 * All GitHub API interaction, auth/session signing and share-record storage lives here.
 */

const GITHUB_API = "https://api.github.com";
const SHARES_PATH = ".gitpan/shares.json";

/* ----------------------------- small utils ----------------------------- */

export function sanitizePath(raw) {
  let p = (raw || "").trim();
  p = p.replace(/\\/g, "/");
  p = p.split("/").filter((seg) => seg !== "" && seg !== "." && seg !== "..").join("/");
  return p;
}

export function encodeGhPath(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export function joinPath(dir, name) {
  return dir ? `${dir}/${name}` : name;
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

function toBase64Url(bytes) {
  let str = "";
  if (typeof bytes === "string") {
    str = btoa(unescape(encodeURIComponent(bytes)));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

async function hmac(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return toBase64Url(sig);
}

/* ------------------------------- sessions ------------------------------- */

function sessionSecret(env) {
  return env.SESSION_SECRET || `${env.ACCESS_PASSWORD || ""}:${env.GITHUB_TOKEN || ""}:gitpan`;
}

export async function signToken(env, payload, ttlSeconds) {
  const body = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const encoded = toBase64Url(JSON.stringify(body));
  const sig = await hmac(sessionSecret(env), encoded);
  return `${encoded}.${sig}`;
}

export async function verifyToken(env, token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expected = await hmac(sessionSecret(env), encoded);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(fromBase64Url(encoded));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (maxAgeSeconds === 0) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  return parts.join("; ");
}

/* ------------------------------ GitHub API ------------------------------ */

export function repoInfo(env) {
  const full = (env.GITHUB_REPO || "").trim();
  const [owner, repo] = full.split("/");
  return { owner, repo, branch: env.GITHUB_BRANCH || "main" };
}

export async function gh(env, path, options = {}) {
  const resp = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "Gitpan-Worker",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  return resp;
}

export async function ghJson(env, path, options = {}) {
  const resp = await gh(env, path, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`GitHub API error ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export async function getRef(env) {
  const { owner, repo, branch } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
}

export async function getCommit(env, sha) {
  const { owner, repo } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/commits/${sha}`);
}

export async function getTreeRecursive(env, treeSha) {
  const { owner, repo } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
}

export async function createTree(env, baseTreeSha, entries) {
  const { owner, repo } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: entries }),
  });
}

export async function createCommit(env, message, treeSha, parentSha) {
  const { owner, repo } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
}

export async function updateRef(env, commitSha) {
  const { owner, repo, branch } = repoInfo(env);
  return ghJson(env, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
}

// Repo may be totally empty (no commits yet). Returns null head info in that case.
export async function getHead(env) {
  try {
    const ref = await getRef(env);
    const commit = await getCommit(env, ref.object.sha);
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  } catch (e) {
    if (e.status === 404 || e.status === 409) return null;
    throw e;
  }
}

export async function listDir(env, path) {
  const { owner, repo, branch } = repoInfo(env);
  const suffix = path ? `/${encodeGhPath(path)}` : "";
  const resp = await gh(env, `/repos/${owner}/${repo}/contents${suffix}?ref=${encodeURIComponent(branch)}`);
  if (resp.status === 404) return [];
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(new Error(`list failed: ${text}`), { status: resp.status });
  }
  const data = await resp.json();
  const arr = Array.isArray(data) ? data : [data];
  return arr
    .filter((it) => it.name !== ".gitkeep")
    .map((it) => ({
      name: it.name,
      path: it.path,
      type: it.type === "dir" ? "dir" : "file",
      size: it.size || 0,
      sha: it.sha,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

export async function getFileMeta(env, path) {
  const { owner, repo, branch } = repoInfo(env);
  const resp = await gh(env, `/repos/${owner}/${repo}/contents/${encodeGhPath(path)}?ref=${encodeURIComponent(branch)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (Array.isArray(data)) return null;
  return { name: data.name, path: data.path, size: data.size, sha: data.sha };
}

// Streams raw file bytes straight from GitHub without buffering.
export async function downloadRaw(env, path) {
  const { owner, repo, branch } = repoInfo(env);
  const resp = await gh(env, `/repos/${owner}/${repo}/contents/${encodeGhPath(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: { Accept: "application/vnd.github.raw" },
  });
  return resp;
}

export async function ensureFolder(env, path) {
  const { owner, repo, branch } = repoInfo(env);
  const keepPath = joinPath(path, ".gitkeep");
  await ghJson(env, `/repos/${owner}/${repo}/contents/${encodeGhPath(keepPath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Create folder ${path}`, content: "", branch }),
  });
}

/**
 * Recursively collects all blob entries under a given directory prefix (or the single
 * file if the path points directly at a file). Returns [{path, sha, mode, size}]
 */
export function collectEntriesUnder(treeEntries, prefix) {
  const norm = prefix.replace(/\/$/, "");
  return treeEntries.filter(
    (e) => e.type === "blob" && (e.path === norm || e.path.startsWith(norm + "/"))
  );
}

/**
 * Deletes one or more files/folders in a single commit using the Git Data API.
 */
export async function deletePaths(env, paths) {
  const head = await getHead(env);
  if (!head) return;
  const { branch } = repoInfo(env);
  const tree = await getTreeRecursive(env, head.treeSha);
  const toRemove = new Set();
  for (const p of paths) {
    for (const e of collectEntriesUnder(tree.tree, p)) toRemove.add(e.path);
    // also remove a lone .gitkeep marker if it's an (otherwise empty) folder
  }
  if (toRemove.size === 0) return;
  const entries = [...toRemove].map((path) => ({ path, mode: "100644", type: "blob", sha: null }));
  const newTree = await createTree(env, head.treeSha, entries);
  const commit = await createCommit(env, `Delete ${paths.join(", ")}`, newTree.sha, head.commitSha);
  await updateRef(env, commit.sha);
}

/**
 * Moves/renames one or more files/folders (each {from, to}) in a single commit,
 * reusing existing blob shas (no content re-upload needed).
 */
export async function movePaths(env, moves) {
  const head = await getHead(env);
  if (!head) throw Object.assign(new Error("Repository is empty"), { status: 400 });
  const tree = await getTreeRecursive(env, head.treeSha);
  const entries = [];
  for (const { from, to } of moves) {
    const matches = collectEntriesUnder(tree.tree, from);
    if (matches.length === 0) {
      throw Object.assign(new Error(`Path not found: ${from}`), { status: 404 });
    }
    for (const m of matches) {
      const rest = m.path.slice(from.length);
      const newPath = to + rest;
      entries.push({ path: newPath, mode: m.mode, type: "blob", sha: m.sha });
      if (newPath !== m.path) {
        entries.push({ path: m.path, mode: m.mode, type: "blob", sha: null });
      }
    }
  }
  const newTree = await createTree(env, head.treeSha, entries);
  const commit = await createCommit(
    env,
    `Move/rename ${moves.map((m) => `${m.from} -> ${m.to}`).join(", ")}`,
    newTree.sha,
    head.commitSha
  );
  await updateRef(env, commit.sha);
}

export async function listAllFilesUnder(env, path) {
  const head = await getHead(env);
  if (!head) return [];
  const tree = await getTreeRecursive(env, head.treeSha);
  return collectEntriesUnder(tree.tree, path)
    .filter((e) => !e.path.endsWith("/.gitkeep"))
    .map((e) => ({ path: e.path, size: e.size || 0, sha: e.sha }));
}

/* -------------------------------- shares -------------------------------- */

export async function readShares(env) {
  const meta = await getFileMeta(env, SHARES_PATH);
  if (!meta) return { list: [], sha: null };
  const resp = await downloadRaw(env, SHARES_PATH);
  if (!resp.ok) return { list: [], sha: meta.sha };
  const text = await resp.text();
  try {
    return { list: JSON.parse(text), sha: meta.sha };
  } catch {
    return { list: [], sha: meta.sha };
  }
}

export async function writeShares(env, list, sha) {
  const { branch } = repoInfo(env);
  const { owner, repo } = repoInfo(env);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2))));
  await ghJson(env, `/repos/${owner}/${repo}/contents/${encodeGhPath(SHARES_PATH)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update shares.json",
      content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}
