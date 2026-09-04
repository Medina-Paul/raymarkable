"use client";
import { useState } from "react";
import { X, AlertCircle } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmText?: string;
  isLoading?: boolean;
  variant?: "danger" | "primary";
};

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText,
  isLoading = false,
  variant = "danger"
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setError(null);
    setInternalLoading(true);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setInternalLoading(false);
    }
  };

  const isBusy = isLoading || internalLoading;
  const defaultText = variant === "danger" ? "Delete" : "Confirm";
  const buttonText = confirmText || defaultText;
  const busyText = confirmText ? `${confirmText}...` : (variant === "danger" ? "Deleting..." : "Confirming...");

  return (
    <div 
      onMouseDown={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-zinc-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white rounded-full transition-colors focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
            {description}
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="flex-1 py-2.5 text-sm font-semibold text-black dark:text-white border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isBusy}
              className={`flex-1 py-2.5 text-sm font-semibold border disabled:opacity-60 cursor-pointer transition-colors focus:outline-none ${ 
                variant === "danger" 
                  ? "bg-red-600 border-red-600 hover:bg-red-700 text-white" 
                  : "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white hover:bg-gray-800 dark:hover:bg-zinc-200" 
              }`}
            >
              {isBusy ? busyText : buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
