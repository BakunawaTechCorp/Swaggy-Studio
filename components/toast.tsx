"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastVariant = "error" | "success" | "info";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    []
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() =>
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  const styles =
    toast.variant === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : toast.variant === "success"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
        : "border-border bg-bg-card/90 text-white";

  return (
    <div
      role="status"
      className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur ${styles}`}
    >
      {toast.message}
    </div>
  );
}
