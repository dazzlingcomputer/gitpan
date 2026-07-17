import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
type ToastCtx = { push: (message: string, kind?: Toast["kind"]) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-all animate-[fadeIn_0.2s_ease-out] ${
              t.kind === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                : t.kind === "error"
                ? "border-red-200 bg-red-50/95 text-red-800"
                : "border-slate-200 bg-white/95 text-slate-700"
            }`}
          >
            {t.kind === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {t.kind === "error" && <XCircle className="h-4 w-4 shrink-0" />}
            {t.kind === "info" && <Info className="h-4 w-4 shrink-0" />}
            <span className="max-w-xs">{t.message}</span>
            <button onClick={() => remove(t.id)} className="ml-1 text-current/60 hover:text-current">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
