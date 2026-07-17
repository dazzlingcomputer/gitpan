import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../../api/client";
import type { ShareRecord } from "../../types";
import { Trash2, Loader2, Lock, Link2 } from "lucide-react";
import { formatDate } from "../../utils/format";

export default function SharesManagerModal({ onClose }: { onClose: () => void }) {
  const [shares, setShares] = useState<ShareRecord[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.listShares().then((r) => setShares(r.shares.sort((a, b) => b.createdAt - a.createdAt)));

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await api.deleteShare(id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="分享管理" onClose={onClose} width="max-w-lg">
      {!shares ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : shares.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">暂无分享</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-700">
                  {s.passwordHash && <Lock className="h-3 w-3 text-slate-400" />}
                  {s.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  /{s.path} · {formatDate(s.createdAt)}
                  {s.expiresAt ? ` · 到期于 ${formatDate(s.expiresAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`${location.origin}/s/${s.id}`)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                title="复制链接"
              >
                <Link2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => revoke(s.id)}
                disabled={busy === s.id}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                title="撤销分享"
              >
                {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
