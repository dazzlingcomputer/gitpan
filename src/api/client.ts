import type { FileItem, ShareRecord } from "../types";

async function req<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    // no body
  }
  if (!resp.ok) {
    throw new Error((data && data.error) || `请求失败 (${resp.status})`);
  }
  return data as T;
}

export const api = {
  login: (password: string) => req<{ ok: boolean }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  session: () => req<{ authenticated: boolean; repo?: string; branch?: string }>("/api/session"),

  list: (path: string) => req<{ path: string; items: FileItem[] }>(`/api/list?path=${encodeURIComponent(path)}`),
  tree: (path: string) => req<{ path: string; files: { path: string; size: number; sha: string }[] }>(`/api/tree?path=${encodeURIComponent(path)}`),
  mkdir: (parent: string, name: string) => req<{ ok: boolean; path: string }>("/api/mkdir", { method: "POST", body: JSON.stringify({ parent, name }) }),
  remove: (paths: string[]) => req<{ ok: boolean }>("/api/delete", { method: "POST", body: JSON.stringify({ paths }) }),
  rename: (path: string, newName: string) => req<{ ok: boolean; path: string }>("/api/rename", { method: "POST", body: JSON.stringify({ path, newName }) }),
  move: (paths: string[], destDir: string) => req<{ ok: boolean }>("/api/move", { method: "POST", body: JSON.stringify({ paths, destDir }) }),

  downloadUrl: (path: string, inline = false) => `/api/download?path=${encodeURIComponent(path)}${inline ? "&inline=1" : ""}`,

  listShares: () => req<{ shares: ShareRecord[] }>("/api/shares"),
  createShare: (path: string, type: "file" | "dir", password?: string, expiresInDays?: number) =>
    req<{ ok: boolean; share: ShareRecord }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ path, type, password, expiresInDays }),
    }),
  deleteShare: (id: string) => req<{ ok: boolean }>(`/api/shares/${id}`, { method: "DELETE" }),

  // public share endpoints
  shareInfo: (id: string) => req<{ id: string; name: string; type: "file" | "dir"; requiresPassword: boolean; expiresAt: number | null }>(`/api/s/${id}`),
  shareVerify: (id: string, password: string) => req<{ ok: boolean }>(`/api/s/${id}/verify`, { method: "POST", body: JSON.stringify({ password }) }),
  shareList: (id: string, path: string) => req<{ path: string; items: FileItem[] }>(`/api/s/${id}/list?path=${encodeURIComponent(path)}`),
  shareTree: (id: string) => req<{ files: { path: string; size: number }[] }>(`/api/s/${id}/tree`),
  shareDownloadUrl: (id: string, path: string, inline = false) =>
    `/api/s/${id}/download?path=${encodeURIComponent(path)}${inline ? "&inline=1" : ""}`,
};
