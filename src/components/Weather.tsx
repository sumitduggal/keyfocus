import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { setStored } from "../storage";

const REFRESH_MS = 15 * 60 * 1000;
const PLACE_KEY = "focus-space-weather-place";

interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

function readPlace(): Place | null {
  try {
    const place = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
    return typeof place?.name === "string" &&
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude)
      ? place
      : null;
  } catch {
    return null;
  }
}

interface Current {
  temperature: number;
  code: number;
  isDay: boolean;
  unit: string;
  city: string;
}

type WeatherState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; current: Current };

interface Condition {
  label: string;
  glyph: string;
}

// WMO weather interpretation codes, as used by Open-Meteo.
function describe(code: number, isDay: boolean): Condition {
  if (code === 0) return { label: "Clear", glyph: isDay ? "☀" : "☾" };
  if (code <= 2) return { label: "Partly cloudy", glyph: isDay ? "⛅" : "☁" };
  if (code === 3) return { label: "Overcast", glyph: "☁" };
  if (code <= 48) return { label: "Fog", glyph: "〰" };
  if (code <= 57) return { label: "Drizzle", glyph: "☂" };
  if (code <= 67) return { label: "Rain", glyph: "☂" };
  if (code <= 77) return { label: "Snow", glyph: "❄" };
  if (code <= 82) return { label: "Showers", glyph: "☂" };
  if (code <= 86) return { label: "Snow showers", glyph: "❄" };
  return { label: "Thunderstorm", glyph: "⚡" };
}

function usesFahrenheit() {
  return new Intl.Locale(navigator.language).region === "US";
}

export function Weather() {
  const [place, setPlace] = useState<Place | null>(readPlace);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const labelRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<WeatherState>(() =>
    place || navigator.geolocation
      ? { status: "loading" }
      : { status: "unavailable", message: "Set location" },
  );

  useEffect(() => {
    if (!place && !navigator.geolocation) return;

    let controller: AbortController | undefined;

    const load = async (latitude: number, longitude: number) => {
      controller?.abort();
      controller = new AbortController();
      const unit = usesFahrenheit() ? "fahrenheit" : "celsius";
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", latitude.toFixed(4));
      url.searchParams.set("longitude", longitude.toFixed(4));
      url.searchParams.set("current", "temperature_2m,weather_code,is_day");
      url.searchParams.set("temperature_unit", unit);
      url.searchParams.set("timezone", "auto");

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
        const body = await response.json();
        setState({
          status: "ready",
          current: {
            temperature: Math.round(body.current.temperature_2m),
            code: body.current.weather_code,
            isDay: body.current.is_day === 1,
            unit: body.current_units.temperature_2m,
            // shortcut: Open-Meteo has no reverse geocoding, so the city is the timezone name (Europe/Berlin -> Berlin); use a reverse geocoder if that is too coarse.
            city: String(body.timezone).split("/").pop()?.replaceAll("_", " ") ?? "",
          },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "unavailable", message: "Weather unavailable" });
      }
    };

    const refresh = () => {
      if (place) {
        void load(place.latitude, place.longitude);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => void load(position.coords.latitude, position.coords.longitude),
        () => setState({ status: "unavailable", message: "Set location" }),
        { maximumAge: REFRESH_MS, timeout: 10_000 },
      );
    };

    refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      controller?.abort();
    };
  }, [place]);

  const choosePlace = (next: Place | null) => {
    setPlace(next);
    setState(
      next || navigator.geolocation
        ? { status: "loading" }
        : { status: "unavailable", message: "Set location" },
    );
    if (next) setStored(PLACE_KEY, JSON.stringify(next));
    else
      try {
        localStorage.removeItem(PLACE_KEY);
      } catch {
        // Nothing to clear if storage is blocked.
      }
    setEditing(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = query.trim();
    if (!name) {
      choosePlace(null);
      return;
    }
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", name);
      url.searchParams.set("count", "1");
      const body = await (await fetch(url)).json();
      const hit = body.results?.[0];
      if (!hit) {
        setError("No match");
        return;
      }
      choosePlace({ name: hit.name, latitude: hit.latitude, longitude: hit.longitude });
    } catch {
      setError("Search failed");
    }
  };

  let label: string;
  let temperature: string | null = null;
  if (state.status === "ready") {
    const { code, isDay, unit } = state.current;
    const condition = describe(code, isDay);
    label = `${condition.glyph} ${place?.name ?? state.current.city} · ${condition.label}`;
    temperature = `${state.current.temperature}${unit}`;
  } else {
    label = state.status === "loading" ? "Locating…" : state.message;
  }

  // Scroll the label only when it is wider than its box.
  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const shift = el.scrollWidth - el.clientWidth;
    el.classList.toggle("scroll", shift > 0);
    el.style.setProperty("--shift", `${shift}px`);
  }, [label, editing]);

  if (editing) {
    return (
      <form className="hud-weather-form" onSubmit={submit}>
        <input
          autoFocus
          value={query}
          placeholder="City, or blank for my location"
          aria-label="Weather location"
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            // Keep typing away from the app's global shortcuts.
            event.stopPropagation();
            if (event.key === "Escape") setEditing(false);
          }}
        />
        {error && <small>{error}</small>}
      </form>
    );
  }

  return (
    <button
      type="button"
      className="hud-status-line hud-weather"
      aria-live="polite"
      title="Set weather location"
      onClick={() => {
        setQuery(place?.name ?? "");
        setEditing(true);
      }}
    >
      <span ref={labelRef} className="hud-weather-label">
        <motion.i key={label} initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {label}
        </motion.i>
      </span>
      {temperature && <b>{temperature}</b>}
    </button>
  );
}
