import { useEffect, useSyncExternalStore } from "react";
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

export function FocusMusic() {
  const music = useSyncExternalStore(subscribeMusic, getMusicState);
  useEffect(() => {
    initMusic();
  }, []);

  const currentTrack = music.tracks[music.trackIndex];
  const hasTracks = music.tracks.length > 0;

  return (
    <div className="frame-body focus-music">
      <section className="music-group" aria-label="Built-in sound">
        <p className="music-label">Built-in sound</p>
        <div className="music-choices" role="group" aria-label="Choose a built-in sound">
          <button type="button" aria-pressed={music.sound === null} className={music.sound === null ? "is-selected" : ""} onClick={() => setSound(null)}>
            None
          </button>
          {BUILT_IN_SOUNDS.map((sound) => (
            <button
              key={sound.id}
              type="button"
              aria-pressed={music.sound === sound.id}
              className={music.sound === sound.id ? "is-selected" : ""}
              onClick={() => setSound(sound.id as SoundId)}
            >
              {sound.label}
            </button>
          ))}
        </div>
        <label className="music-slider">
          <span>Sound volume</span>
          <input type="range" min={0} max={1} step={0.01} value={music.soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} />
        </label>
      </section>

      <section className="music-group" aria-label="Your tracks">
        <p className="music-label">Your tracks</p>
        {music.loadError && <p className="frame-foot">Track list not found. Add audio files to public/music and list them in tracks.json.</p>}
        {!music.loadError && !hasTracks && (
          <p className="frame-foot">No tracks yet. Add audio files to public/music and list them in tracks.json.</p>
        )}
        {hasTracks && (
          <ol className="music-tracks">
            {music.tracks.map((track, index) => (
              <li key={track.file}>
                <button type="button" aria-current={index === music.trackIndex} className={index === music.trackIndex ? "is-selected" : ""} onClick={() => selectTrack(index)}>
                  {track.title}
                </button>
              </li>
            ))}
          </ol>
        )}
        <label className="music-slider">
          <span>Track volume</span>
          <input type="range" min={0} max={1} step={0.01} value={music.trackVolume} onChange={(event) => setTrackVolume(Number(event.target.value))} />
        </label>
      </section>

      <div className="music-controls">
        <button type="button" onClick={previousTrack} disabled={!hasTracks} aria-label="Previous track">
          ‹
        </button>
        <button type="button" className="music-play" onClick={togglePlaying} aria-label={music.playing ? "Pause" : "Play"}>
          {music.playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={nextTrack} disabled={!hasTracks} aria-label="Next track">
          ›
        </button>
        <button type="button" aria-pressed={music.loop} className={music.loop ? "is-selected" : ""} onClick={() => setLoop(!music.loop)}>
          Loop
        </button>
      </div>
      <p className="music-now" aria-live="polite">
        {currentTrack ? `Track: ${currentTrack.title}` : "No track selected"}
        {music.playing ? "" : " · paused"}
      </p>
    </div>
  );
}
