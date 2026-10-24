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

function startSound(sound: SoundId) {
  if (soundAudios.has(sound)) return;
  const audio = new Audio(`/sounds/${soundFile(sound)}`);
  audio.loop = true;
  audio.volume = state.soundVolume;
  soundAudios.set(sound, audio);
  audio.play().catch(() => emit({ playing: false }));
}

function stopSound(sound: SoundId) {
  soundAudios.get(sound)?.pause();
  soundAudios.delete(sound);
}

function stopAllSounds() {
  [...soundAudios.keys()].forEach(stopSound);
}

function currentTrackAudio(): HTMLAudioElement | null {
  const track = state.tracks[state.trackIndex];
  if (!track) return null;
  if (!trackAudio || trackAudio.dataset.file !== track.file) {
    trackAudio?.pause();
    trackAudio = new Audio(`/music/${track.file}`);
    trackAudio.dataset.file = track.file;
    trackAudio.onended = onTrackEnded;
  }
  trackAudio.loop = state.loop;
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
  audio?.play().catch(() => emit({ playing: false }));
}

function pauseAll() {
  stopAllSounds();
  trackAudio?.pause();
  emit({ playing: false });
}

export function play(): void {
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
  trackAudio?.pause();
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

export function nextTrack(): void {
  chooseTrack(nextTrackIndex(state.trackIndex, state.tracks.length));
}

export function previousTrack(): void {
  chooseTrack(previousTrackIndex(state.trackIndex, state.tracks.length));
}
