import musicTracks from "virtual:music-tracks";
import {
  BUILT_IN_SOUNDS,
  DEFAULT_MUSIC_SETTINGS,
  loadMusicSettings,
  nextTrackIndex,
  previousTrackIndex,
  saveMusicSettings,
  type MusicSettings,
  type SoundId,
  type Track,
} from "./music";

export interface PlayerState extends MusicSettings {
  tracks: Track[];
  playing: boolean;
}

// One player for the whole app, so audio keeps playing when the person switches frames.
let state: PlayerState = {
  ...DEFAULT_MUSIC_SETTINGS,
  tracks: [],
  playing: false,
};
const listeners = new Set<() => void>();
let started = false;

// One looping audio element per selected built-in sound, so several can play together.
const soundAudios = new Map<SoundId, HTMLAudioElement>();
let trackAudio: HTMLAudioElement | null = null;
// The full file each preview is still loading, so dropping the preview can stop that download too.
const loadingFull = new Map<HTMLAudioElement, HTMLAudioElement>();

// Stops an element for good and frees its download. Used when nothing will play it again.
function drop(audio: HTMLAudioElement) {
  const full = loadingFull.get(audio);
  loadingFull.delete(audio);
  for (const element of [audio, full]) {
    if (!element) continue;
    element.pause();
    element.removeAttribute("src");
    element.load();
  }
}

function emit(next: Partial<PlayerState>) {
  state = { ...state, ...next };
  saveMusicSettings(localStorage, {
    sounds: state.sounds,
    soundVolume: state.soundVolume,
    trackIndex: state.trackIndex,
    trackVolume: state.trackVolume,
    loop: state.loop,
  });
  listeners.forEach((listener) => listener());
}

export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMusicState(): PlayerState {
  return state;
}

// Loads saved settings and the track list once. Playback stays paused.
export function initMusic(): void {
  if (started) return;
  started = true;
  const tracks: Track[] = musicTracks;
  const saved = loadMusicSettings(localStorage);
  const trackIndex = saved.trackIndex < tracks.length ? saved.trackIndex : 0;
  state = { ...state, ...saved, tracks, trackIndex };
  emit({});
}

// Built-in sounds are audio files in public/sounds, looped under a track.
function soundFile(sound: SoundId): string {
  return BUILT_IN_SOUNDS.find((entry) => entry.id === sound)?.file ?? "";
}

// A missing preview is not a stop: the full file takes over. Any other failure stops playback.
function playAudio(audio: HTMLAudioElement) {
  audio.play().catch(() => {
    if (!audio.error) emit({ playing: false });
  });
}

// Plays the short preview at once and loads the full file. When the full file can play, it takes over
// at the preview's position, so the change is not heard.
// shortcut: the position comes from the preview, so a long wait lands inside the preview's length.
function upgrade(preview: HTMLAudioElement, src: string, isCurrent: () => boolean, replace: (full: HTMLAudioElement) => void) {
  const full = new Audio(src);
  loadingFull.set(preview, full);
  full.preload = "auto";
  full.volume = preview.volume;
  Object.assign(full.dataset, preview.dataset);
  full.addEventListener("error", () => {
    if (isCurrent()) emit({ playing: false });
  });
  full.addEventListener(
    "canplaythrough",
    () => {
      loadingFull.delete(preview);
      if (!isCurrent()) return;
      full.currentTime = preview.currentTime;
      if (state.playing) playAudio(full);
      preview.pause();
      replace(full);
    },
    { once: true },
  );
}

function startSound(sound: SoundId) {
  const existing = soundAudios.get(sound);
  if (existing) {
    playAudio(existing);
    return;
  }
  const file = soundFile(sound);
  const preview = new Audio(`/previews/sounds/${file}`);
  preview.loop = true;
  preview.volume = state.soundVolume;
  soundAudios.set(sound, preview);
  playAudio(preview);
  upgrade(preview, `/sounds/${file}`, () => soundAudios.get(sound) === preview, (full) => {
    full.loop = true;
    soundAudios.set(sound, full);
  });
}

function stopSound(sound: SoundId) {
  const audio = soundAudios.get(sound);
  if (audio) drop(audio);
  soundAudios.delete(sound);
}

function stopAllSounds() {
  [...soundAudios.keys()].forEach(stopSound);
}

function currentTrackAudio(): HTMLAudioElement | null {
  const track = state.tracks[state.trackIndex];
  if (!track) return null;
  if (!trackAudio || trackAudio.dataset.file !== track.file) {
    if (trackAudio) drop(trackAudio);
    const preview = new Audio(`/previews/music/${track.file}`);
    preview.loop = true; // repeats until the full track takes over
    preview.dataset.file = track.file;
    trackAudio = preview;
    upgrade(preview, `/music/${track.file}`, () => trackAudio === preview, (full) => {
      full.loop = state.loop;
      full.onended = onTrackEnded;
      trackAudio = full;
    });
  }
  trackAudio.volume = state.trackVolume;
  return trackAudio;
}

// With loop on, the browser repeats the track. Otherwise play the next one, stopping after the last.
// Moving on by itself keeps the selected sounds; only choosing a track stops them.
function onTrackEnded() {
  if (state.loop) return;
  if (state.trackIndex === state.tracks.length - 1) {
    pauseAll();
    return;
  }
  moveToTrack(nextTrackIndex(state.trackIndex, state.tracks.length));
}

function startTrack() {
  const audio = currentTrackAudio();
  if (audio) playAudio(audio);
}

// Sounds are paused, not dropped, so playing again resumes every selected one without reloading.
function pauseAll() {
  soundAudios.forEach((audio) => audio.pause());
  trackAudio?.pause();
  emit({ playing: false });
}

export function play(): void {
  if (state.trackIndex < 0 && state.sounds.length === 0) return;
  state.sounds.forEach(startSound);
  startTrack();
  emit({ playing: true });
}

export function pause(): void {
  pauseAll();
}

export function togglePlaying(): void {
  if (state.playing) pause();
  else play();
}

// Adds or removes one built-in sound from the mix. Sounds are layered, so several can be on.
export function toggleSound(sound: SoundId): void {
  const selected = state.sounds.includes(sound);
  const sounds = selected ? state.sounds.filter((id) => id !== sound) : [...state.sounds, sound];
  emit({ sounds });
  if (selected) {
    stopSound(sound);
    return;
  }
  // Choosing a sound starts playing, as pressing play would.
  if (state.playing) startSound(sound);
  else play();
}

export function clearSounds(): void {
  stopAllSounds();
  emit({ sounds: [] });
}

export function setSoundVolume(volume: number): void {
  emit({ soundVolume: volume });
  soundAudios.forEach((audio) => (audio.volume = volume));
}

export function setTrackVolume(volume: number): void {
  emit({ trackVolume: volume });
  if (trackAudio) trackAudio.volume = volume;
}

export function setLoop(loop: boolean): void {
  emit({ loop });
  if (trackAudio) trackAudio.loop = loop;
}

// Moves to another track and keeps playing if it was playing. Sounds are not touched.
function moveToTrack(index: number): void {
  if (state.tracks.length === 0) return;
  const next = Math.min(Math.max(index, 0), state.tracks.length - 1);
  if (trackAudio) drop(trackAudio);
  trackAudio = null;
  emit({ trackIndex: next });
  if (state.playing) startTrack();
}

// Choosing a track stops the built-in sounds, so the chosen track plays on its own.
function chooseTrack(index: number): void {
  clearSounds();
  moveToTrack(index);
}

// Picking a track from the list also starts it, as the person expects from a click.
export function selectTrack(index: number): void {
  if (state.tracks.length === 0) return;
  chooseTrack(index);
  play();
}

// Clicking the selected track again: it stops and no track is chosen. Built-in sounds keep playing.
export function deselectTrack(): void {
  if (trackAudio) drop(trackAudio);
  trackAudio = null;
  emit({ trackIndex: -1, playing: state.playing && state.sounds.length > 0 });
}

export function nextTrack(): void {
  chooseTrack(nextTrackIndex(state.trackIndex, state.tracks.length));
}

export function previousTrack(): void {
  chooseTrack(previousTrackIndex(state.trackIndex, state.tracks.length));
}
