import { useRef } from "react";
import {
  ChevronRight,
  Home,
  FolderPlus,
  Upload,
  UploadCloud,
  Search,
  LogOut,
  Trash2,
  Share2,
  FolderInput,
  Download,
} from "lucide-react";

export function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const segments = path ? path.split("/") : [];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
      <button
        onClick={() => onNavigate("")}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
      >
        <Home className="h-4 w-4" /> 我的网盘
      </button>
      {segments.map((seg, i) => {
        const p = segments.slice(0, i + 1).join("/");
        return (
          <div key={p} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              onClick={() => onNavigate(p)}
              className="max-w-[160px] truncate rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
              title={seg}
            >
              {seg}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function TopBar({
  path,
  onNavigate,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
  search,
  onSearch,
  onLogout,
  selectionCount,
  onBatchDelete,
  onBatchMove,
  onBatchDownload,
  onShareSelected,
}: {
  path: string;
  onNavigate: (p: string) => void;
  onNewFolder: () => void;
  onUploadFiles: (files: FileList) => void;
  onUploadFolder: (files: FileList) => void;
  search: string;
  onSearch: (v: string) => void;
  onLogout: () => void;
  selectionCount: number;
  onBatchDelete: () => void;
  onBatchMove: () => void;
  onBatchDownload: () => void;
  onShareSelected: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
        <Breadcrumb path={path} onNavigate={onNavigate} />
        <div className="relative hidden shrink-0 sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索当前文件夹"
            className="w-40 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:w-56 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          onClick={onNewFolder}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <FolderPlus className="h-4 w-4" /> 新建文件夹
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-200 hover:brightness-110"
        >
          <Upload className="h-4 w-4" /> 上传文件
        </button>
        <button
          onClick={() => folderInput.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <UploadCloud className="h-4 w-4" /> 上传文件夹
        </button>
        <button
          onClick={onLogout}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> 退出
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          // @ts-ignore non-standard attrs for folder selection
          webkitdirectory="true"
          directory="true"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUploadFolder(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {selectionCount > 0 && (
        <div className="flex items-center gap-2 border-t border-indigo-100 bg-indigo-50/70 px-4 py-2 text-xs">
          <span className="font-medium text-indigo-700">已选择 {selectionCount} 项</span>
          <div className="ml-2 flex items-center gap-1">
            <button onClick={onBatchDownload} className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-white">
              <Download className="h-3.5 w-3.5" /> 下载
            </button>
            {selectionCount === 1 && (
              <button onClick={onShareSelected} className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-white">
                <Share2 className="h-3.5 w-3.5" /> 分享
              </button>
            )}
            <button onClick={onBatchMove} className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-white">
              <FolderInput className="h-3.5 w-3.5" /> 移动
            </button>
            <button onClick={onBatchDelete} className="flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-white">
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
