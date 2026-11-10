import type { ReactNode } from "react";
import { useIntro } from "./useIntro";

export interface IntroHelpButtonProps {
  className?: string;
  /** Accessible name. Default "Start page intro". */
  label?: string;
  /** Replaces the built-in "?" icon. */
  children?: ReactNode;
}

export function IntroHelpButton({ className, label = "Start page intro", children }: IntroHelpButtonProps) {
  const { hasIntro, start } = useIntro();
  return (
    <button
      type="button"
      className={className ? `ii-help-btn ${className}` : "ii-help-btn"}
      aria-label={label}
      title={label}
      disabled={!hasIntro}
      onClick={start}
    >
      {children ?? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2-2.4 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="16.9" r="0.95" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
