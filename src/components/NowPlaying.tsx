import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { BUILT_IN_SOUNDS, type SoundId } from "../music";
import {
  getMusicState,
  initMusic,
  nextTrack,
  playStation,
  type Station,
  previousTrack,
  selectTrack,
  setLoop,
  clearSounds,
  deselectTrack,
  toggleSound,
  setSoundVolume,
  setTrackVolume,
  subscribeMusic,
  togglePlaying,
} from "../music-player";

// Free community radio directory with open CORS; radio.garden itself has no public API.
interface RadioResult {
  name: string;
  url_resolved: string;
  geo_lat: number | null;
  geo_long: number | null;
}

async function fetchStations(params: string): Promise<RadioResult[]> {
  const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?hidebroken=true&${params}`);
  if (!response.ok) throw new Error("radio search failed");
  return (await response.json()) as RadioResult[];
}

// Only https streams play from an https page.
const toStations = (found: RadioResult[]): Station[] =>
  found.filter((s) => s.url_resolved.startsWith("https://")).slice(0, 12).map((s) => ({ name: s.name.trim(), url: s.url_resolved }));

const searchStations = async (name: string) => toStations(await fetchStations(`name=${encodeURIComponent(name)}&limit=30&order=votes&reverse=true`));

// Straight-line distance is enough to rank stations; the unit does not matter.
const distance = (s: RadioResult, lat: number, lon: number) => (s.geo_lat! - lat) ** 2 + ((s.geo_long! - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;

// Asks the server for the closest stations, then re-sorts here in case it ignores the order.
async function nearbyStations(lat: number, lon: number): Promise<Station[]> {
  const found = await fetchStations(`has_geo_info=true&geo_lat=${lat}&geo_long=${lon}&order=geo_distance&limit=60`);
  const located = found.filter((s) => s.geo_lat != null && s.geo_long != null);
  return toStations(located.sort((a, b) => distance(a, lat, lon) - distance(b, lat, lon)));
}

// Always-available player in the right-hand control panel. Playback is app-wide.
// The slim row stays in the panel; the music options open as a popup from the + button.
export function NowPlaying() {
  const music = useSyncExternalStore(subscribeMusic, getMusicState);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const marqueeRef = useRef<HTMLButtonElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<"tracks" | "radio" | "sounds">("tracks");
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [radioStatus, setRadioStatus] = useState("");
  useEffect(() => {
    initMusic();
  }, []);

  // Clicking anywhere outside the popup and its buttons closes it. The title counts as a button.
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || toggleRef.current?.contains(target) || marqueeRef.current?.contains(target)) return;
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

  const findStations = async () => {
    setRadioStatus("Searching…");
    try {
      const found = await searchStations(query.trim());
      setStations(found);
      setRadioStatus(found.length ? "" : "No stations found");
    } catch {
      setRadioStatus("Radio search is unavailable");
    }
  };

  const findNearby = () => {
    if (!navigator.geolocation) {
      setRadioStatus("Location is unavailable");
      return;
    }
    setRadioStatus("Finding stations near you…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const found = await nearbyStations(coords.latitude, coords.longitude);
          setStations(found);
          setRadioStatus(found.length ? "" : "No stations found");
        } catch {
          setRadioStatus("Radio search is unavailable");
        }
      },
      () => setRadioStatus("Location permission denied"),
    );
  };

  const hasTracks = music.tracks.length > 0;
  const current = music.tracks[music.trackIndex];
  const title = music.station ? music.station.name : current ? current.title : hasTracks ? "Pick a track" : "No tracks yet";
  // While playing, the title shimmers; it also scrolls when it is too long to fit.
  const trackClass = ["now-playing-track", music.playing && "is-playing", music.playing && overflowing && "is-scrolling"]
    .filter(Boolean)
    .join(" ");

  // The name scrolls only while playing, and only when it is too long to fit.
  useLayoutEffect(() => {
    const box = marqueeRef.current;
    if (!box) return;
    const measure = () => setOverflowing(box.scrollWidth > box.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [title]);

  return (
    <section className="now-playing" aria-label="Now playing">
      <button
        ref={marqueeRef}
        type="button"
        className="now-playing-marquee"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${title}, music options`}
        onClick={() => setOpen(!open)}
      >
        <span className={trackClass} aria-live="polite">
          <span>{title}</span>
          {music.playing && overflowing && <span aria-hidden="true">{title}</span>}
        </span>
      </button>

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
          <div className="now-playing-tabs" role="tablist" aria-label="Music categories">
            {(["tracks", "radio", "sounds"] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-selected" : ""} onClick={() => setTab(id)}>
                {id === "tracks" ? "Tracks" : id === "radio" ? "Radio" : "Sounds"}
              </button>
            ))}
          </div>
          <div className="now-playing-body" role="tabpanel">
          {tab === "tracks" && (
            <>
          <p className="now-playing-label">Your tracks</p>
          {hasTracks ? (
            <ol className="now-playing-tracks">
              {music.tracks.map((track, index) => (
                <li key={track.file}>
                  <button
                    type="button"
                    aria-current={index === music.trackIndex}
                    className={index === music.trackIndex ? "is-selected" : ""}
                    onClick={() => (index === music.trackIndex ? deselectTrack() : selectTrack(index))}
                  >
                    {track.title}
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
            </>
          )}

          {tab === "radio" && (
            <>
          <form
            className="now-playing-radio"
            onSubmit={(event) => {
              event.preventDefault();
              void findStations();
            }}
          >
            <input type="search" value={query} placeholder="Search stations" aria-label="Search radio stations" onChange={(event) => setQuery(event.target.value)} />
            <button type="submit">Search</button>
            <button type="button" onClick={findNearby} aria-label="Stations near me" title="Stations near me">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </button>
          </form>
          {radioStatus && <p className="now-playing-label" role="status">{radioStatus}</p>}
          {stations.length > 0 && (
            <ol className="now-playing-tracks">
              {stations.map((station) => (
                <li key={station.url}>
                  <button
                    type="button"
                    aria-current={music.station?.url === station.url}
                    className={music.station?.url === station.url ? "is-selected" : ""}
                    onClick={() => playStation(station)}
                  >
                    {station.name}
                  </button>
                </li>
              ))}
            </ol>
          )}
            </>
          )}

          {tab === "sounds" && (
            <>
          <div className="now-playing-sounds" role="group" aria-label="Built-in sound">
            <button type="button" aria-pressed={music.sounds.length === 0} className={music.sounds.length === 0 ? "is-selected" : ""} onClick={clearSounds}>
              None
            </button>
            {BUILT_IN_SOUNDS.map((sound) => {
              const selected = music.sounds.includes(sound.id as SoundId);
              return (
                <button key={sound.id} type="button" aria-pressed={selected} className={selected ? "is-selected" : ""} onClick={() => toggleSound(sound.id as SoundId)}>
                  {sound.label}
                </button>
              );
            })}
          </div>

          <label className="now-playing-slider">
            <span>Sound</span>
            <input type="range" min={0} max={1} step={0.01} value={music.soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} />
          </label>
            </>
          )}

          {tab !== "sounds" && (
          <div className="now-playing-volume">
            <label className="now-playing-slider">
              <span>Track</span>
              <input type="range" min={0} max={1} step={0.01} value={music.trackVolume} onChange={(event) => setTrackVolume(Number(event.target.value))} />
            </label>
            {tab === "tracks" && (
              <button type="button" aria-pressed={music.loop} aria-label="Loop" title="Loop" className={music.loop ? "is-selected" : ""} onClick={() => setLoop(!music.loop)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 2l4 4-4 4" />
                  <path d="M3 11V9a3 3 0 0 1 3-3h15" />
                  <path d="M7 22l-4-4 4-4" />
                  <path d="M21 13v2a3 3 0 0 1-3 3H3" />
                </svg>
              </button>
            )}
          </div>
          )}
          </div>
        </div>
      )}
    </section>
  );
}
