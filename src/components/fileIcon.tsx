import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  File as FileIcon,
  FileType2,
} from "lucide-react";
import { extOf } from "../utils/format";

export function FileTypeIcon({ name, type, className }: { name: string; type: "file" | "dir"; className?: string }) {
  if (type === "dir") return <Folder className={className} fill="currentColor" fillOpacity={0.15} />;
  const ext = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext))
    return <FileImage className={className} />;
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(ext)) return <FileVideo className={className} />;
  if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext)) return <FileAudio className={className} />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <FileArchive className={className} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={className} />;
  if (ext === "pdf") return <FileType2 className={className} />;
  if (["js", "ts", "tsx", "jsx", "json", "css", "html", "xml", "py", "sh", "go", "rs", "java", "c", "cpp", "h"].includes(ext))
    return <FileCode className={className} />;
  if (["txt", "md", "log"].includes(ext)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}
