import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Share2, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useUpload } from "../context/UploadContext";
import { api } from "../api/client";
import type { FileItem } from "../types";
import { TopBar } from "../components/TopBar";
import FileTable from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import PromptModal from "../components/modals/PromptModal";
import ConfirmModal from "../components/modals/ConfirmModal";
import MoveModal from "../components/modals/MoveModal";
import ShareModal from "../components/modals/ShareModal";
import SharesManagerModal from "../components/modals/SharesManagerModal";
import PreviewModal from "../components/modals/PreviewModal";
import { fileListToPicked, readDataTransferItems } from "../utils/dnd";
import { downloadFolderAsZip } from "../utils/zipDownload";

type ModalState =
  | { type: "newFolder" }
  | { type: "rename"; item: FileItem }
  | { type: "delete"; items: FileItem[] }
  | { type: "move"; items: FileItem[] }
  | { type: "share"; item: FileItem }
  | { type: "sharesManager" }
  | { type: "preview"; item: FileItem }
  | null;

export default function DrivePage() {
  const { branch, logout } = useAuth();
  const { push } = useToast();
  const { enqueue, version } = useUpload();
  const [params, setParams] = useSearchParams();
  const path = params.get("path") || "";

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const navigate = (p: string) => {
    setSelected(new Set());
    setSearch("");
    setParams(p ? { path: p } : {});
  };

  const load = useCallback(() => {
    setLoading(true);
    api
      .list(path)
      .then((res) => setItems(res.items))
      .catch((err) => push(err.message || "加载失败", "error"))
      .finally(() => setLoading(false));
  }, [path, push]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh (debounced) whenever uploads make progress, so completed files
  // show up without spamming the API for every single task in a batch.
  const lastVersion = useRef(version);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (version !== lastVersion.current) {
      lastVersion.current = version;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(load, 500);
    }
  }, [version, load]);

  const filtered = useMemo(
    () => (search ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : items),
    [items, search]
  );

  const toggleSelect = (p: string, exclusive?: boolean) => {
    setSelected((prev) => {
      const next = new Set(exclusive ? [] : prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const selectedItems = items.filter((i) => selected.has(i.path));

  const openItem = (item: FileItem) => {
    if (item.type === "dir") navigate(item.path);
    else setModal({ type: "preview", item });
  };

  const uploadFiles = (files: FileList) => {
    enqueue(fileListToPicked(files), path, branch);
  };

  const uploadFolder = (files: FileList) => {
    enqueue(fileListToPicked(files), path, branch);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.items && e.dataTransfer.items.length) {
      const picked = await readDataTransferItems(e.dataTransfer.items);
      if (picked.length) enqueue(picked, path, branch);
    } else if (e.dataTransfer.files.length) {
      enqueue(fileListToPicked(e.dataTransfer.files), path, branch);
    }
  };

  const doDownload = async (item: FileItem) => {
    if (item.type === "file") {
      const a = document.createElement("a");
      a.href = api.downloadUrl(item.path);
      a.click();
      return;
    }
    push(`正在打包“${item.name}”，请稍候…`, "info");
    try {
      const { files } = await api.tree(item.path);
      if (files.length === 0) {
        push("文件夹为空", "error");
        return;
      }
      await downloadFolderAsZip(
        files.map((f) => ({ path: f.path, relativePath: f.path.slice(item.path.length + 1) })),
        (p) => api.downloadUrl(p),
        item.name
      );
      push("打包下载完成", "success");
    } catch (err: any) {
      push(err.message || "下载失败", "error");
    }
  };

  const batchDownload = async () => {
    for (const item of selectedItems) await doDownload(item);
  };

  const handleAction = async (
    action: "preview" | "download" | "rename" | "move" | "share" | "delete",
    item: FileItem
  ) => {
    if (action === "preview") setModal({ type: "preview", item });
    if (action === "download") await doDownload(item);
    if (action === "rename") setModal({ type: "rename", item });
    if (action === "move") setModal({ type: "move", items: [item] });
    if (action === "share") setModal({ type: "share", item });
    if (action === "delete") setModal({ type: "delete", items: [item] });
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) setDragging(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <TopBar
        path={path}
        onNavigate={navigate}
        onNewFolder={() => setModal({ type: "newFolder" })}
        onUploadFiles={uploadFiles}
        onUploadFolder={uploadFolder}
        search={search}
        onSearch={setSearch}
        onLogout={() => logout()}
        selectionCount={selected.size}
        onBatchDelete={() => setModal({ type: "delete", items: selectedItems })}
        onBatchMove={() => setModal({ type: "move", items: selectedItems })}
        onBatchDownload={batchDownload}
        onShareSelected={() => selectedItems[0] && setModal({ type: "share", item: selectedItems[0] })}
      />

      <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
        <p className="text-xs text-slate-400">{filtered.length} 项</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModal({ type: "sharesManager" })}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600"
          >
            <Share2 className="h-3.5 w-3.5" /> 分享管理
          </button>
          <button onClick={load} className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600">
            <RefreshCw className="h-3.5 w-3.5" /> 刷新
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 pt-2">
        <FileTable
          items={filtered}
          loading={loading}
          selected={selected}
          onToggleSelect={toggleSelect}
          onOpen={openItem}
          onAction={handleAction}
        />
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-indigo-600/10 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-indigo-400 bg-white/90 px-10 py-8 text-center shadow-xl">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-indigo-700">松开鼠标即可上传到当前文件夹</p>
          </div>
        </div>
      )}

      <UploadPanel />

      {modal?.type === "newFolder" && (
        <PromptModal
          title="新建文件夹"
          label="文件夹名称"
          confirmText="创建"
          onCancel={() => setModal(null)}
          onConfirm={async (name) => {
            await api.mkdir(path, name);
            push("文件夹创建成功", "success");
            setModal(null);
            load();
          }}
        />
      )}

      {modal?.type === "rename" && (
        <PromptModal
          title="重命名"
          label="新名称"
          initialValue={modal.item.name}
          confirmText="重命名"
          onCancel={() => setModal(null)}
          onConfirm={async (name) => {
            await api.rename(modal.item.path, name);
            push("重命名成功", "success");
            setModal(null);
            load();
          }}
        />
      )}

      {modal?.type === "delete" && (
        <ConfirmModal
          title="删除确认"
          danger
          message={`确定要删除 ${modal.items.length} 项吗？该操作会在 GitHub 仓库中永久删除对应文件，且不可恢复。`}
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.remove(modal.items.map((i) => i.path));
            push("删除成功", "success");
            setSelected(new Set());
            setModal(null);
            load();
          }}
        />
      )}

      {modal?.type === "move" && (
        <MoveModal
          excludePaths={modal.items.map((i) => i.path)}
          onCancel={() => setModal(null)}
          onConfirm={async (destDir) => {
            await api.move(
              modal.items.map((i) => i.path),
              destDir
            );
            push("移动成功", "success");
            setSelected(new Set());
            setModal(null);
            load();
          }}
        />
      )}

      {modal?.type === "share" && <ShareModal item={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === "sharesManager" && <SharesManagerModal onClose={() => setModal(null)} />}
      {modal?.type === "preview" && (
        <PreviewModal
          name={modal.item.name}
          size={modal.item.size}
          inlineUrl={api.downloadUrl(modal.item.path, true)}
          downloadUrl={api.downloadUrl(modal.item.path)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
