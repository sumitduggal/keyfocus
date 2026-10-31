import { useEffect, useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Theme } from "../types";
import { alertSounds, playAlert } from "../settings";
import type { Settings } from "../settings";
import type { WorkspaceViewId } from "../workspace/view";
import { workspaceViewMeta } from "../workspace/view";
import { BookmarksSettings } from "./BookmarksSettings";

interface SettingsPanelProps {
  theme: Theme;
  settings: Settings;
  workspaceView: WorkspaceViewId;
  anchor: HTMLElement | null;
  onToggleTheme: () => void;
  onWorkspaceViewChange: (view: WorkspaceViewId) => void;
  onChange: (patch: Partial<Settings>) => void;
  onClose: (restoreFocus: boolean) => void;
}

const workspaceViewIds: WorkspaceViewId[] = [
  "operator",
  "calm",
  "immersive",
  "overview",
];

export function SettingsPanel({
  theme,
  settings,
  workspaceView,
  anchor,
  onToggleTheme,
  onWorkspaceViewChange,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const placePanel = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const margin = 12;
      const gap = 12;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const trigger = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      const openRight = trigger ? trigger.left + trigger.right < viewportWidth : false;
      const fitsRight = trigger !== null && viewportWidth - trigger.right - gap - margin >= width;
      const fitsLeft = trigger !== null && trigger.left - gap - margin >= width;

      let left = viewportWidth - width - margin;
      if (trigger && openRight && fitsRight) {
        left = trigger.right + gap;
      } else if (trigger && fitsLeft) {
        left = trigger.left - gap - width;
      } else if (trigger && fitsRight) {
        left = trigger.right + gap;
      } else if (trigger) {
        left = (viewportWidth - width) / 2;
      }

      const triggerCenter = trigger ? (trigger.top + trigger.bottom) / 2 : viewportHeight / 2;
      const top = Math.max(
        margin,
        Math.min(viewportHeight - height - margin, triggerCenter - height / 2),
      );

      panel.style.position = "fixed";
      panel.style.left = `${Math.max(margin, Math.min(viewportWidth - width - margin, left))}px`;
      panel.style.right = "auto";
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${Math.max(120, viewportHeight - margin * 2)}px`;
    };

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [anchor]);

  useEffect(() => {
    panelRef.current?.focus();
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      const target = event.target as Element;
      // The Settings button toggles the panel itself.
      if (target.closest?.("[data-settings-toggle]")) return;
      if (panelRef.current && !panelRef.current.contains(target))
        onClose(false);
    };
    document.addEventListener("focusin", closeWhenFocusLeaves);
    return () => document.removeEventListener("focusin", closeWhenFocusLeaves);
  }, [onClose]);

  return (
    <motion.aside
      ref={panelRef}
      className="feature-aside settings-aside"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 36 }}
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
        <button
          type="button"
          aria-label="Close settings"
          onClick={() => onClose(true)}
        >
          ×
        </button>
      </div>

      <section
        className="settings-workspace-view"
        aria-labelledby="workspace-view-heading"
      >
        <b id="workspace-view-heading">Workspace view</b>
        <div
          className="workspace-view-choices"
          role="group"
          aria-labelledby="workspace-view-heading"
        >
          {workspaceViewIds.map((view) => (
            <button
              key={view}
              className="workspace-view-choice"
              type="button"
              aria-pressed={workspaceView === view}
              aria-labelledby={`workspace-view-${view}-label`}
              aria-describedby={`workspace-view-${view}-description`}
              onClick={() => onWorkspaceViewChange(view)}
            >
              <span
                className="workspace-view-choice-label"
                id={`workspace-view-${view}-label`}
              >
                {workspaceViewMeta[view].label}
              </span>
              <span
                className="workspace-view-choice-description"
                id={`workspace-view-${view}-description`}
              >
                {workspaceViewMeta[view].description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="settings-pair">
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
            <b>Temperature</b>
            <small>Weather in workspace headers</small>
          </span>
          <button
            type="button"
            aria-label={`Temperature unit: ${settings.temperatureUnit}. Switch`}
            onClick={() =>
              onChange({
                temperatureUnit:
                  settings.temperatureUnit === "celsius"
                    ? "fahrenheit"
                    : "celsius",
              })
            }
          >
            {settings.temperatureUnit === "celsius" ? "°C" : "°F"}
          </button>
        </div>
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
          onChange={(event) =>
            onChange({ alertVolume: Number(event.target.value) })
          }
        />
      </div>

      <BookmarksSettings />
    </motion.aside>
  );
}
