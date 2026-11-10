import { useIntro } from "./useIntro";

export interface IntroAutoStartSwitchProps {
  className?: string;
  /** Visible label. Default "Show intro on new pages". */
  label?: string;
}

export function IntroAutoStartSwitch({ className, label = "Show intro on new pages" }: IntroAutoStartSwitchProps) {
  const { autoStartEnabled, setAutoStartEnabled } = useIntro();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoStartEnabled}
      className={className ? `ii-switch ${className}` : "ii-switch"}
      onClick={() => setAutoStartEnabled(!autoStartEnabled)}
    >
      <span className="ii-switch-track" aria-hidden="true">
        <span className="ii-switch-thumb" />
      </span>
      <span className="ii-switch-label">{label}</span>
    </button>
  );
}
