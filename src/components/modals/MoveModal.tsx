import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../../api/client";
import { Folder, ChevronRight, Home, Loader2 } from "lucide-react";
import type { FileItem } from "../../types";

export default function MoveModal({
  excludePaths,
  onCancel,
  onConfirm,
}: {
  excludePaths: string[];
  onCancel: () => void;
  onConfirm: (destDir: string) => Promise<void> | void;
}) {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .list(path)
      .then((res) => setItems(res.items.filter((i) => i.type === "dir")))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [path]);

  const isBlocked = (p: string) => excludePaths.some((ex) => p === ex || p.startsWith(ex + "/"));
  const segments = path ? path.split("/") : [];

  const confirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(path);
    } catch (err: any) {
      setError(err.message || "移动失败");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="移动到" onClose={onCancel}>
      <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
        <button onClick={() => setPath("")} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-indigo-600 hover:bg-white">
          <Home className="h-3.5 w-3.5" /> 根目录
        </button>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              onClick={() => setPath(segments.slice(0, i + 1).join("/"))}
              className="rounded px-1.5 py-0.5 font-medium text-slate-600 hover:bg-white"
            >
              {seg}
            </button>
          </div>
        ))}
      </div>
      <div className="h-56 overflow-y-auto rounded-xl border border-slate-100">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.filter((i) => !isBlocked(i.path)).length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-slate-400">没有子文件夹</p>
        ) : (
          items
            .filter((i) => !isBlocked(i.path))
            .map((i) => (
              <button
                key={i.path}
                onClick={() => setPath(i.path)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                <Folder className="h-4 w-4 text-indigo-400" /> {i.name}
              </button>
            ))
        )}
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex items-center justify-between">
        <p className="truncate text-xs text-slate-400">目标：/{path || "（根目录）"}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
            取消
          </button>
          <button
            onClick={confirm}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            移动到此处
          </button>
        </div>
      </div>
    </Modal>
  );
}
