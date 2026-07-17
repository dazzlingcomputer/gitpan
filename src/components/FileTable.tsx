import { useEffect, useRef, useState } from "react";
import { MoreVertical, Download, Share2, Pencil, FolderInput, Trash2, Eye, FolderOpen } from "lucide-react";
import type { FileItem } from "../types";
import { FileTypeIcon } from "./fileIcon";
import { formatBytes } from "../utils/format";

type Props = {
  items: FileItem[];
  loading: boolean;
  selected: Set<string>;
  onToggleSelect: (path: string, exclusive?: boolean) => void;
  onOpen: (item: FileItem) => void;
  onAction: (action: "preview" | "download" | "rename" | "move" | "share" | "delete", item: FileItem) => void;
};

export default function FileTable({ items, loading, selected, onToggleSelect, onOpen, onAction }: Props) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <FolderOpen className="h-12 w-12" strokeWidth={1.2} />
        <p className="text-sm">这里空空如也，拖拽文件到此处即可上传</p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-8 sm:px-4">
      <div className="hidden grid-cols-[24px_1fr_110px_180px_100px] gap-3 px-3 py-2 text-xs font-medium text-slate-400 sm:grid">
        <span />
        <span>名称</span>
        <span>大小</span>
        <span>更新方式</span>
        <span className="text-right">操作</span>
      </div>
      <div className="flex flex-col">
        {items.map((item) => {
          const isSelected = selected.has(item.path);
          return (
            <div
              key={item.path}
              onClick={(e) => onToggleSelect(item.path, !(e.metaKey || e.ctrlKey))}
              onDoubleClick={() => onOpen(item)}
              className={`group grid cursor-pointer grid-cols-[24px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition sm:grid-cols-[24px_1fr_110px_180px_100px] ${
                isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(item.path)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              <div className="flex min-w-0 items-center gap-2.5">
                <FileTypeIcon
                  name={item.name}
                  type={item.type}
                  className={`h-5 w-5 shrink-0 ${item.type === "dir" ? "text-indigo-500" : "text-slate-400"}`}
                />
                <span className="truncate text-sm text-slate-700">{item.name}</span>
              </div>
              <span className="hidden text-xs text-slate-400 sm:block">{item.type === "dir" ? "--" : formatBytes(item.size)}</span>
              <span className="hidden text-xs text-slate-400 sm:block">{item.type === "dir" ? "文件夹" : "GitHub 仓库文件"}</span>
              <div className="relative flex justify-end" ref={menuFor === item.path ? menuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === item.path ? null : item.path);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 opacity-0 hover:bg-slate-200/70 group-hover:opacity-100 sm:opacity-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuFor === item.path && (
                  <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
                    {item.type === "file" && (
                      <MenuItem icon={Eye} label="预览" onClick={() => { onAction("preview", item); setMenuFor(null); }} />
                    )}
                    <MenuItem icon={Download} label="下载" onClick={() => { onAction("download", item); setMenuFor(null); }} />
                    <MenuItem icon={Share2} label="分享" onClick={() => { onAction("share", item); setMenuFor(null); }} />
                    <MenuItem icon={Pencil} label="重命名" onClick={() => { onAction("rename", item); setMenuFor(null); }} />
                    <MenuItem icon={FolderInput} label="移动" onClick={() => { onAction("move", item); setMenuFor(null); }} />
                    <MenuItem icon={Trash2} label="删除" danger onClick={() => { onAction("delete", item); setMenuFor(null); }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 ${danger ? "text-red-600" : "text-slate-600"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
