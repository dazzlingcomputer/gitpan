import { ChevronDown, ChevronUp, X, CheckCircle2, XCircle, Loader2, FileUp } from "lucide-react";
import { useUpload } from "../context/UploadContext";
import { formatBytes, formatSpeed } from "../utils/format";

const statusLabel: Record<string, string> = {
  queued: "等待中",
  encoding: "处理中",
  uploading: "上传中",
  done: "已完成",
  error: "失败",
  canceled: "已取消",
};

export default function UploadPanel() {
  const { tasks, panelOpen, setPanelOpen, cancel, clearFinished } = useUpload();
  if (tasks.length === 0) return null;

  const activeCount = tasks.filter((t) => t.status === "encoding" || t.status === "uploading" || t.status === "queued").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
      <div
        className="flex cursor-pointer items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm text-white"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          <span>{activeCount > 0 ? `正在上传 ${activeCount} 项` : `已完成 ${doneCount} 项`}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearFinished();
            }}
            className="rounded px-1.5 py-0.5 text-[11px] text-white/80 hover:bg-white/20"
          >
            清除已完成
          </button>
          {panelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </div>
      {panelOpen && (
        <div className="max-h-80 overflow-y-auto p-2">
          {tasks.map((t) => (
            <div key={t.id} className="mb-1.5 rounded-xl px-2.5 py-2 hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{t.relativePath}</p>
                  <p className="text-[11px] text-slate-400">
                    {statusLabel[t.status]}
                    {t.status === "uploading" && t.speed > 0 && ` · ${formatSpeed(t.speed)}`}
                    {" · "}
                    {formatBytes(t.loaded)} / {formatBytes(t.total)}
                  </p>
                </div>
                {t.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                {t.status === "error" && (
                  <span title={t.error}>
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  </span>
                )}
                {(t.status === "encoding" || t.status === "uploading" || t.status === "queued") && (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
                    <button onClick={() => cancel(t.id)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    t.status === "error" ? "bg-red-400" : t.status === "done" ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                  }`}
                  style={{ width: `${t.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
