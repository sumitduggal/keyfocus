import { useEffect, useRef } from "react";
import type { Theme } from "../types";
import { alertSounds, playAlert } from "../settings";
import type { Settings } from "../settings";

interface SettingsPanelProps {
  theme: Theme;
  settings: Settings;
  anchorY: number | null;
  onToggleTheme: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onClose: (restoreFocus: boolean) => void;
}

export function SettingsPanel({
  theme,
  settings,
  anchorY,
  onToggleTheme,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose(false);
    };
    document.addEventListener("focusin", closeWhenFocusLeaves);
    return () => document.removeEventListener("focusin", closeWhenFocusLeaves);
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      className="feature-aside settings-aside"
      style={{ top: anchorY ?? "50%" }}
      aria-label="Settings"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        // Close the panel without also sending the global Escape to the command bar.
        event.stopPropagation();
        onClose(true);
      }}
    >
      <div className="feature-aside-heading">
        <span aria-hidden="true">⚙</span>
        <b>Settings</b>
        <button type="button" aria-label="Close settings" onClick={() => onClose(true)}>
          ×
        </button>
      </div>

      <div className="settings-row">
        <span>
          <b>Appearance</b>
          <small>Shortcut ⌘⇧L</small>
        </span>
        <button type="button" onClick={onToggleTheme}>
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </div>

      <div className="settings-row">
        <span>
          <b>Timer alert</b>
          <small>Plays when a session ends</small>
        </span>
        <span className="settings-controls">
          <select
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
            onClick={() => playAlert(settings.alertSound, settings.alertVolume)}
          >
            Play
          </button>
        </span>
      </div>

      <div className="settings-row">
        <b>Alert volume</b>
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
    </aside>
  );
}
