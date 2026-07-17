import { useState } from "react";
import Modal from "./Modal";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  title,
  message,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex gap-3">
        {danger && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
        <p className="pt-1 text-sm text-slate-600">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
          取消
        </button>
        <button
          onClick={run}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          确定
        </button>
      </div>
    </Modal>
  );
}
