import React from "react";
import { Loader } from "lucide-react";

/**
 * LoadingState / EmptyState / ErrorState
 *
 * One loading treatment for the whole app. Panels were previously mixing a
 * spinner in one place and a bare "Loading…" string in another; use these so
 * every pending surface looks identical.
 */

export function LoadingState({ label = "Loading", className = "" }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 py-8 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader className="h-5 w-5 animate-spin text-primary" />
      <p className="text-[11px] text-gray-500">{label}…</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title = "No data", message, className = "" }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 px-6 py-8 text-center ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 text-gray-300" />}
      <p className="text-[12px] font-medium text-dark">{title}</p>
      {message && <p className="max-w-sm text-[11px] leading-relaxed text-gray-500">{message}</p>}
    </div>
  );
}

export function ErrorState({ icon: Icon, title = "Something went wrong", message, onRetry, className = "" }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 px-6 py-8 text-center ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 text-warning" />}
      <p className="text-[12px] font-medium text-dark">{title}</p>
      {message && <p className="max-w-md text-[11px] leading-relaxed text-gray-500">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium
                     text-gray-700 transition-colors hover:bg-gray-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default LoadingState;
