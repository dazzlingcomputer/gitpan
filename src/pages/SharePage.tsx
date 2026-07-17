import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Loader2, CloudCog, Download, PackageOpen, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import type { FileItem } from "../types";
import { ToastProvider, useToast } from "../context/ToastContext";
import FileTable from "../components/FileTable";
import PreviewModal from "../components/modals/PreviewModal";
import { Breadcrumb } from "../components/TopBar";
import { downloadFolderAsZip } from "../utils/zipDownload";

function SharePageInner() {
  const { id = "" } = useParams();
  const { push } = useToast();
  const [info, setInfo] = useState<{ name: string; type: "file" | "dir"; requiresPassword: boolean } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [relPath, setRelPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  useEffect(() => {
    api
      .shareInfo(id)
      .then((res) => {
        setInfo(res);
        setNeedsPassword(res.requiresPassword);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const loadDir = (p: string) => {
    setLoading(true);
    api
      .shareList(id, p)
      .then((res) => setItems(res.items))
      .catch((err) => push(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (info && !needsPassword && info.type === "dir") loadDir(relPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, needsPassword, relPath]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError("");
    try {
      await api.shareVerify(id, password);
      setNeedsPassword(false);
    } catch (err: any) {
      setAuthError(err.message || "密码错误");
    } finally {
      setVerifying(false);
    }
  };

  const download = async (item: FileItem) => {
    if (item.type === "file") {
      const a = document.createElement("a");
      a.href = api.shareDownloadUrl(id, item.path);
      a.click();
      return;
    }
    push(`正在打包“${item.name}”…`, "info");
    try {
      const { files } = await api.shareTree(id);
      const prefix = item.path;
      const subset = files.filter((f) => f.path === prefix || f.path.startsWith(prefix + "/"));
      await downloadFolderAsZip(
        subset.map((f) => ({ path: f.path, relativePath: f.path.slice(prefix.length + 1) })),
        (p) => api.shareDownloadUrl(id, p),
        item.name
      );
      push("打包下载完成", "success");
    } catch (err: any) {
      push(err.message, "error");
    }
  };

  const downloadWholeShare = async () => {
    if (!info) return;
    if (info.type === "file") {
      const a = document.createElement("a");
      a.href = api.shareDownloadUrl(id, "");
      a.click();
      return;
    }
    push("正在打包整个文件夹…", "info");
    try {
      const { files } = await api.shareTree(id);
      await downloadFolderAsZip(
        files.map((f) => ({ path: f.path, relativePath: f.path })),
        (p) => api.shareDownloadUrl(id, p),
        info.name
      );
      push("打包下载完成", "success");
    } catch (err: any) {
      push(err.message, "error");
    }
  };

  if (notFound) {
    return (
      <CenterCard>
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <p className="text-center text-sm text-slate-500">分享不存在或已过期</p>
      </CenterCard>
    );
  }

  if (!info) {
    return (
      <CenterCard>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
      </CenterCard>
    );
  }

  if (needsPassword) {
    return (
      <CenterCard>
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">“{info.name}” 需要密码访问</p>
        </div>
        <form onSubmit={verify} className="space-y-3">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入访问密码"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{authError}</p>}
          <button
            disabled={verifying || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            访问
          </button>
        </form>
      </CenterCard>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <CloudCog className="h-5 w-5 text-indigo-500" />
        <span className="font-semibold text-slate-800">Gitpan 分享</span>
        {info.type === "dir" ? (
          <Breadcrumb path={relPath} onNavigate={setRelPath} />
        ) : (
          <span className="truncate text-sm text-slate-500">{info.name}</span>
        )}
        <button
          onClick={downloadWholeShare}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110"
        >
          <PackageOpen className="h-4 w-4" /> 下载全部
        </button>
      </div>

      {info.type === "file" ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="mb-4 text-sm text-slate-500">单文件分享</p>
            <p className="mb-6 text-lg font-medium text-slate-800">{info.name}</p>
            <button
              onClick={downloadWholeShare}
              className="mx-auto flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" /> 下载文件
            </button>
            <button
              onClick={() => setPreviewItem({ name: info.name, path: "", type: "file", size: 0 })}
              className="mx-auto mt-3 block text-xs text-indigo-500 hover:underline"
            >
              在线预览
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl pt-2">
          <FileTable
            items={items}
            loading={loading}
            selected={new Set()}
            onToggleSelect={() => {}}
            onOpen={(item) => (item.type === "dir" ? setRelPath(item.path) : setPreviewItem(item))}
            onAction={(action, item) => {
              if (action === "preview") setPreviewItem(item);
              if (action === "download") download(item);
            }}
          />
        </div>
      )}

      {previewItem && (
        <PreviewModal
          name={previewItem.name}
          size={previewItem.size}
          inlineUrl={api.shareDownloadUrl(id, previewItem.path, true)}
          downloadUrl={api.shareDownloadUrl(id, previewItem.path)}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">{children}</div>
    </div>
  );
}

export default function SharePage() {
  return (
    <ToastProvider>
      <SharePageInner />
    </ToastProvider>
  );
}
