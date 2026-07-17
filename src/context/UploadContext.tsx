import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { UploadTask } from "../types";
import { api } from "../api/client";
import { buildUploadBlob, uploadBlob } from "../utils/uploader";
import type { PickedFile } from "../utils/dnd";

type UploadCtx = {
  tasks: UploadTask[];
  version: number;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  enqueue: (files: PickedFile[], destDir: string, branch: string) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
};

const Ctx = createContext<UploadCtx | null>(null);

const CONCURRENCY = 3;
const shaCache = new Map<string, string | undefined>();

export function UploadProvider({ children, onUploaded }: { children: ReactNode; onUploaded?: (destDir: string) => void }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [version, setVersion] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const queueRef = useRef<UploadTask[]>([]);
  const activeRef = useRef(0);
  const lastDestDirRef = useRef("");
  const speedSampleRef = useRef<Map<string, { t: number; loaded: number }>>(new Map());

  const patchTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const getExistingSha = useCallback(async (destPath: string) => {
    if (shaCache.has(destPath)) return shaCache.get(destPath);
    const parent = destPath.includes("/") ? destPath.slice(0, destPath.lastIndexOf("/")) : "";
    const name = destPath.split("/").pop()!;
    try {
      const { items } = await api.list(parent);
      const found = items.find((i) => i.name === name && i.type === "file");
      shaCache.set(destPath, found?.sha);
      return found?.sha;
    } catch {
      return undefined;
    }
  }, []);

  const pumpRef = useRef<(branch: string) => void>(() => {});

  const runTask = useCallback(
    async (task: UploadTask, branch: string) => {
      const controller = new AbortController();
      try {
        patchTask(task.id, { status: "encoding" });
        const sha = await getExistingSha(task.destPath);
        const blob = await buildUploadBlob(
          task.file,
          { message: `Upload ${task.destPath} via Gitpan`, branch, sha },
          (loaded, total) => {
            patchTask(task.id, { progress: total ? Math.round((loaded / total) * 40) : 40, loaded });
          },
          controller.signal
        );
        patchTask(task.id, { status: "uploading" });
        speedSampleRef.current.set(task.id, { t: performance.now(), loaded: 0 });
        const { promise, xhr } = uploadBlob(
          `/api/upload?path=${encodeURIComponent(task.destPath)}`,
          blob,
          (loaded, total) => {
            const now = performance.now();
            const sample = speedSampleRef.current.get(task.id);
            let speedPatch: Partial<UploadTask> = {};
            if (sample) {
              const dt = (now - sample.t) / 1000;
              if (dt > 0.15) {
                speedPatch.speed = (loaded - sample.loaded) / dt;
                speedSampleRef.current.set(task.id, { t: now, loaded });
              }
            }
            const uploadPct = total ? (loaded / total) * 60 : 60;
            patchTask(task.id, {
              progress: Math.min(100, Math.round(40 + uploadPct)),
              loaded,
              total: total || task.total,
              ...speedPatch,
            });
          }
        );
        patchTask(task.id, { xhr });
        await promise;
        patchTask(task.id, { status: "done", progress: 100, speed: 0 });
        shaCache.delete(task.destPath);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          patchTask(task.id, { status: "canceled" });
        } else {
          patchTask(task.id, { status: "error", error: err?.message || "上传失败" });
        }
      } finally {
        activeRef.current -= 1;
        setVersion((v) => v + 1);
        pumpRef.current(branch);
        if (activeRef.current === 0 && queueRef.current.length === 0) {
          onUploaded?.(lastDestDirRef.current);
        }
      }
    },
    [getExistingSha, patchTask, onUploaded]
  );

  pumpRef.current = (branch: string) => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      activeRef.current += 1;
      runTask(next, branch);
    }
  };

  const enqueue = useCallback(
    (files: PickedFile[], destDir: string, branch: string) => {
      lastDestDirRef.current = destDir;
      const newTasks: UploadTask[] = files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f.file,
        relativePath: f.relativePath,
        destPath: destDir ? `${destDir}/${f.relativePath}` : f.relativePath,
        status: "queued",
        progress: 0,
        loaded: 0,
        total: f.file.size,
        speed: 0,
      }));
      setTasks((prev) => [...newTasks, ...prev]);
      queueRef.current.push(...newTasks);
      setPanelOpen(true);
      pumpRef.current(branch);
    },
    []
  );

  const cancel = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const t = prev.find((x) => x.id === id);
        t?.xhr?.abort();
        return prev;
      });
      queueRef.current = queueRef.current.filter((t) => t.id !== id);
      patchTask(id, { status: "canceled" });
    },
    [patchTask]
  );

  const clearFinished = useCallback(() => {
    setTasks((prev) => prev.filter((t) => !["done", "canceled", "error"].includes(t.status)));
  }, []);

  return (
    <Ctx.Provider value={{ tasks, version, panelOpen, setPanelOpen, enqueue, cancel, clearFinished }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
