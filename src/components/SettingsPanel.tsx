import { useEffect, useRef } from "react";
import type { Theme } from "../types";
import { alertSounds, playAlert } from "../settings";
import type { Settings } from "../settings";

interface SettingsPanelProps {
  theme: Theme;
  settings: Settings;
  onToggleTheme: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const row = "flex items-center justify-between gap-4 py-3 border-b border-border last:border-0";
const control =
  "bg-surface-2 text-text border border-border rounded-md px-2 py-1.5 text-[13px] focus-visible:outline-2 focus-visible:outline-accent";

export function SettingsPanel({
  theme,
  settings,
  onToggleTheme,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("button, select, input")?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="w-[min(480px,92vw)] bg-surface border border-border rounded-lg p-5 text-text"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">Settings</h2>
          <button type="button" className={control} onClick={onClose}>
            Done
          </button>
        </div>

        <div className={row}>
          <span>
            <b className="block text-[13px]">Appearance</b>
            <small className="text-text-faint">Shortcut ⌘⇧L</small>
          </span>
          <button type="button" className={control} onClick={onToggleTheme}>
            {theme === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
        </div>

        <div className={row}>
          <b className="text-[13px]">Timer alert</b>
          <span className="flex gap-2">
            <select
              className={control}
              aria-label="Timer alert sound"
              value={settings.alertSound}
              onChange={(event) => onChange({ alertSound: event.target.value })}
            >
              {alertSounds.map((sound) => (
                <option key={sound.id} value={sound.id}>
                  {sound.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={control}
              onClick={() => playAlert(settings.alertSound, settings.alertVolume)}
            >
              Play
            </button>
          </span>
        </div>

        <div className={row}>
          <b className="text-[13px]">Alert volume</b>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Alert volume"
            value={settings.alertVolume}
            onChange={(event) => onChange({ alertVolume: Number(event.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
