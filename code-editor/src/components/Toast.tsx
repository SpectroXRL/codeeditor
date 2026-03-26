import { useEffect, useState } from "react";
import { useProgressError } from "../stores/progressSelectors";
import { useProgressStore } from "../stores/progressStore";
import "./Toast.css";

interface ToastMessage {
  id: number;
  message: string;
  type: "error" | "success" | "warning";
}

let toastId = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const progressError = useProgressError();

  // Watch for progress errors and create toasts
  useEffect(() => {
    if (progressError) {
      const id = ++toastId;
      setToasts((prev) => [
        ...prev,
        { id, message: progressError, type: "error" },
      ]);

      // Clear the error from store
      useProgressStore.setState({ error: null });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    }
  }, [progressError]);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => dismissToast(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
