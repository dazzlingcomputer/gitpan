export type FileItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha?: string;
};

export type ShareRecord = {
  id: string;
  path: string;
  name: string;
  type: "file" | "dir";
  passwordHash: string | null;
  createdAt: number;
  expiresAt: number | null;
};

export type UploadTask = {
  id: string;
  file: File;
  relativePath: string;
  destPath: string;
  status: "queued" | "encoding" | "uploading" | "done" | "error" | "canceled";
  progress: number; // 0-100
  loaded: number;
  total: number;
  speed: number; // bytes/sec
  error?: string;
  xhr?: XMLHttpRequest;
};
