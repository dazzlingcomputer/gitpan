import { useEffect, useState } from "react";
import { X, Download, Loader2, FileWarning } from "lucide-react";
import { isPreviewable, formatBytes } from "../../utils/format";
import { FileTypeIcon } from "../fileIcon";

export default function PreviewModal({
  name,
  size,
  inlineUrl,
  downloadUrl,
  onClose,
}: {
  name: string;
  size: number;
  inlineUrl: string;
  downloadUrl: string;
  onClose: () => void;
}) {
  const kind = isPreviewable(name);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (kind === "text" || kind === "code") {
      fetch(inlineUrl, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.text();
        })
        .then(setText)
        .catch(() => setError(true));
    }
  }, [inlineUrl, kind]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex min-w-0 items-center gap-2">
          <FileTypeIcon name={name} type="file" className="h-4 w-4 shrink-0 text-white/80" />
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="shrink-0 text-xs text-white/50">{formatBytes(size)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={downloadUrl}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> 下载
          </a>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        {kind === "image" && <img src={inlineUrl} alt={name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />}
        {kind === "video" && (
          <video src={inlineUrl} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl" />
        )}
        {kind === "audio" && (
          <div className="w-full max-w-md rounded-2xl bg-white/10 p-8">
            <audio src={inlineUrl} controls autoPlay className="w-full" />
          </div>
        )}
        {kind === "pdf" && <iframe src={inlineUrl} title={name} className="h-full w-full max-w-4xl rounded-lg bg-white shadow-2xl" />}
        {(kind === "text" || kind === "code") &&
          (error ? (
            <PreviewFallback name={name} downloadUrl={downloadUrl} />
          ) : text === null ? (
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          ) : (
            <pre className="max-h-full w-full max-w-4xl overflow-auto rounded-xl bg-slate-950 p-5 text-left text-xs leading-relaxed text-slate-200 shadow-2xl">
              {text}
            </pre>
          ))}
        {!kind && <PreviewFallback name={name} downloadUrl={downloadUrl} />}
      </div>
    </div>
  );
}

function PreviewFallback({ name, downloadUrl }: { name: string; downloadUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-10 text-white/70">
      <FileWarning className="h-10 w-10" />
      <p className="text-sm">暂不支持预览该类型文件</p>
      <a
        href={downloadUrl}
        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
      >
        <Download className="h-4 w-4" /> 下载 {name}
      </a>
    </div>
  );
}
