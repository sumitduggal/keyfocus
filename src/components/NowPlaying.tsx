import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { BUILT_IN_SOUNDS, type SoundId } from "../music";
import {
  getMusicState,
  initMusic,
  nextTrack,
  previousTrack,
  selectTrack,
  setLoop,
  setSound,
  setSoundVolume,
  setTrackVolume,
  subscribeMusic,
  togglePlaying,
} from "../music-player";

// Always-available player in the right-hand control panel. Playback is app-wide.
// The slim row stays in the panel; the music options open as a popup from the + button.
export function NowPlaying() {
  const music = useSyncExternalStore(subscribeMusic, getMusicState);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    initMusic();
  }, []);

  // Clicking anywhere outside the popup and its button closes it.
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) popupRef.current?.focus();
  }, [open]);

  const closePopup = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const popupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // Close the popup without also resetting the app's focus with the global Escape.
      event.stopPropagation();
      closePopup();
    }
  };

  const hasTracks = music.tracks.length > 0;
  const current = music.tracks[music.trackIndex];
  const title = current ? current.title : hasTracks ? "Pick a track" : "No tracks yet";

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="now-playing-row">
        <button type="button" className="now-playing-step" onClick={previousTrack} disabled={!hasTracks} aria-label="Previous track">
          ‹
        </button>
        <button type="button" className="now-playing-play" onClick={togglePlaying} aria-label={music.playing ? "Pause" : "Play"}>
          {music.playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="now-playing-step" onClick={nextTrack} disabled={!hasTracks} aria-label="Next track">
          ›
        </button>
        <p className="now-playing-title" aria-live="polite">
          {title}
        </p>
        <button
          ref={toggleRef}
          type="button"
          className="now-playing-toggle"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Music options"
          onClick={() => setOpen(!open)}
        >
          {open ? "−" : "+"}
        </button>
      </div>

      {open && (
        <div ref={popupRef} className="now-playing-popup" role="dialog" aria-label="Music options" tabIndex={-1} onKeyDown={popupKeyDown}>
          <div className="now-playing-popup-head">
            <span>Music options</span>
            <button type="button" aria-label="Close music options" onClick={closePopup}>
              ×
            </button>
          </div>
          <div className="now-playing-body">
          <div className="now-playing-controls">
            <button type="button" aria-pressed={music.loop} className={music.loop ? "is-selected" : ""} onClick={() => setLoop(!music.loop)}>
              Loop
            </button>
          </div>

          <p className="now-playing-label">Your tracks</p>
          {hasTracks ? (
            <ol className="now-playing-tracks">
              {music.tracks.map((track, index) => (
                <li key={track.file}>
                  <button type="button" aria-current={index === music.trackIndex} className={index === music.trackIndex ? "is-selected" : ""} onClick={() => selectTrack(index)}>
                    {track.title}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="now-playing-hint">Add audio files to public/music and list them in tracks.json.</p>
          )}

          <p className="now-playing-label">Built-in sound</p>
          <div className="now-playing-sounds" role="group" aria-label="Built-in sound">
            <button type="button" aria-pressed={music.sound === null} className={music.sound === null ? "is-selected" : ""} onClick={() => setSound(null)}>
              None
            </button>
            {BUILT_IN_SOUNDS.map((sound) => (
              <button key={sound.id} type="button" aria-pressed={music.sound === sound.id} className={music.sound === sound.id ? "is-selected" : ""} onClick={() => setSound(sound.id as SoundId)}>
                {sound.label}
              </button>
            ))}
          </div>

          <label className="now-playing-slider">
            <span>Sound</span>
            <input type="range" min={0} max={1} step={0.01} value={music.soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} />
          </label>
          <label className="now-playing-slider">
            <span>Track</span>
            <input type="range" min={0} max={1} step={0.01} value={music.trackVolume} onChange={(event) => setTrackVolume(Number(event.target.value))} />
          </label>
          </div>
        </div>
      )}
    </section>
  );
}
