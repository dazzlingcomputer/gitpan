import { useState } from "react";
import Modal from "./Modal";
import { api } from "../../api/client";
import type { FileItem } from "../../types";
import { Loader2, Copy, Check, Link2 } from "lucide-react";

export default function ShareModal({ item, onClose }: { item: FileItem; onClose: () => void }) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expires, setExpires] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; password?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.createShare(
        item.path,
        item.type,
        usePassword ? password || Math.random().toString(36).slice(2, 8) : undefined,
        expires === "0" ? undefined : Number(expires)
      );
      const url = `${location.origin}/s/${res.share.id}`;
      setLink({ url, password: usePassword ? password || undefined : undefined });
    } catch (err: any) {
      setError(err.message || "创建分享失败");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.password ? `${link.url}\n访问密码: ${link.password}` : link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={`分享 “${item.name}”`} onClose={onClose}>
      {!link ? (
        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
            <span className="text-sm text-slate-600">需要访问密码</span>
            <input
              type="checkbox"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
          </label>
          {usePassword && (
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则自动生成"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">有效期</label>
            <select
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="0">永久有效</option>
              <option value="1">1 天</option>
              <option value="7">7 天</option>
              <option value="30">30 天</option>
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
              取消
            </button>
            <button
              onClick={create}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              生成分享链接
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Link2 className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="flex-1 truncate text-sm text-slate-700">{link.url}</span>
            <button onClick={copy} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {link.password && (
            <p className="text-xs text-slate-500">
              访问密码：<span className="font-mono font-semibold text-slate-700">{link.password}</span>
            </p>
          )}
          <div className="flex justify-end">
            <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">
              完成
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
