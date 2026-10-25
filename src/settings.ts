import { setStored } from "./storage";

export interface Sound {
  id: string;
  label: string;
  src: string | null;
}

export const alertSounds: Sound[] = [
  { id: "beep", label: "Soft beep", src: null },
  { id: "glass-bell", label: "Glass bell", src: "/alerts/glass-bell-chime-sound-effect.mp3" },
  { id: "coin-grab", label: "Coin grab", src: "/alerts/coin-grab-sound-effect.mp3" },
];

export type TemperatureUnit = "celsius" | "fahrenheit";

export interface Settings {
  alertSound: string;
  alertVolume: number;
  temperatureUnit: TemperatureUnit;
}

const KEY = "focus-space-settings";
export const defaultSettings: Settings = {
  alertSound: "glass-bell",
  alertVolume: 0.7,
  // Until chosen, the browser's region decides: Fahrenheit for the US, Celsius elsewhere.
  temperatureUnit: new Intl.Locale(navigator.language).region === "US" ? "fahrenheit" : "celsius",
};

export const loadSettings = (): Settings => {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: Settings) =>
  setStored(KEY, JSON.stringify(settings));

// One audio context is reused, so repeated alerts do not each leave a new one open.
let beepContext: AudioContext | null = null;

export const playAlert = (soundId: string, volume: number) => {
  const sound = alertSounds.find((item) => item.id === soundId);
  if (sound?.src) {
    const audio = new Audio(sound.src);
    audio.volume = volume;
    // Browsers refuse to play until the page has been used; the alert is skipped then.
    audio.play().catch(() => undefined);
    return;
  }
  beepContext ??= new AudioContext();
  const context = beepContext;
  void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.setValueAtTime(880, context.currentTime + 0.16);
  gain.gain.setValueAtTime(0.18 * volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
};
