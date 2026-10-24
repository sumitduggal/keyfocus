import {
  DEFAULT_MUSIC_SETTINGS,
  loadMusicSettings,
  nextTrackIndex,
  parseTrackList,
  previousTrackIndex,
  saveMusicSettings,
  type MusicSettings,
  type SoundId,
  type Track,
} from "./music";

export interface PlayerState extends MusicSettings {
  tracks: Track[];
  playing: boolean;
  loadError: boolean;
}

// One player for the whole app, so audio keeps playing when the person switches frames.
let state: PlayerState = {
  ...DEFAULT_MUSIC_SETTINGS,
  tracks: [],
  playing: false,
  loadError: false,
};
const listeners = new Set<() => void>();
let started = false;

let context: AudioContext | null = null;
let soundNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let trackAudio: HTMLAudioElement | null = null;

function emit(next: Partial<PlayerState>) {
  state = { ...state, ...next };
  saveMusicSettings(localStorage, {
    sound: state.sound,
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
  state = { ...state, ...loadMusicSettings(localStorage) };
  fetch("/music/tracks.json")
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
    .then((json: unknown) => {
      const tracks = parseTrackList(json);
      trackIndexClamp(tracks.length);
      emit({ tracks, loadError: false });
    })
    .catch(() => emit({ tracks: [], loadError: true }));
}

function trackIndexClamp(count: number) {
  if (state.trackIndex >= count) state = { ...state, trackIndex: 0 };
}

function audioContext(): AudioContext {
  if (!context) context = new AudioContext();
  return context;
}

// Built-in sounds are generated from white noise, shaped by filters.
function makeNoise(ctx: AudioContext, sound: SoundId): { source: AudioBufferSourceNode; output: AudioNode } {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Brown noise is a running sum of white noise.
    last = (last + 0.02 * white) / 1.02;
    data[i] = sound === "brown" ? last * 3.5 : white * 0.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  if (sound === "rain") {
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.4;
  } else if (sound === "cafe") {
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.7;
  } else {
    filter.type = "lowpass";
    filter.frequency.value = sound === "brown" ? 400 : 12000;
  }
  source.connect(filter);
  source.start();
  return { source, output: filter };
}

function startSound() {
  stopSound();
  if (!state.sound) return;
  const ctx = audioContext();
  const { source, output } = makeNoise(ctx, state.sound);
  const gain = ctx.createGain();
  gain.gain.value = state.soundVolume;
  output.connect(gain).connect(ctx.destination);
  soundNodes = { source, gain };
}

function stopSound() {
  if (!soundNodes) return;
  soundNodes.source.stop();
  soundNodes.source.disconnect();
  soundNodes.gain.disconnect();
  soundNodes = null;
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
function onTrackEnded() {
  if (state.loop) return;
  const next = nextTrackIndex(state.trackIndex, state.tracks.length);
  if (next === 0 && state.trackIndex === state.tracks.length - 1) {
    pauseAll();
    return;
  }
  selectTrack(next);
}

function startTrack() {
  const audio = currentTrackAudio();
  audio?.play().catch(() => emit({ playing: false }));
}

function pauseAll() {
  stopSound();
  trackAudio?.pause();
  emit({ playing: false });
}

export function play(): void {
  const ctx = audioContext();
  void ctx.resume();
  if (state.sound) startSound();
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

export function setSound(sound: SoundId | null): void {
  emit({ sound });
  if (state.playing) {
    stopSound();
    if (sound) startSound();
  }
}

export function setSoundVolume(volume: number): void {
  emit({ soundVolume: volume });
  if (soundNodes) soundNodes.gain.gain.value = volume;
}

export function setTrackVolume(volume: number): void {
  emit({ trackVolume: volume });
  if (trackAudio) trackAudio.volume = volume;
}

export function setLoop(loop: boolean): void {
  emit({ loop });
  if (trackAudio) trackAudio.loop = loop;
}

// Switches track. Keeps playing if it was playing.
export function selectTrack(index: number): void {
  if (state.tracks.length === 0) return;
  const next = Math.min(Math.max(index, 0), state.tracks.length - 1);
  trackAudio?.pause();
  emit({ trackIndex: next });
  if (state.playing) startTrack();
}

export function nextTrack(): void {
  selectTrack(nextTrackIndex(state.trackIndex, state.tracks.length));
}

export function previousTrack(): void {
  selectTrack(previousTrackIndex(state.trackIndex, state.tracks.length));
}
