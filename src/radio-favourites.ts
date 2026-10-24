// Radio stations the person has saved, kept in the browser and shown grouped by country.
import type { Station } from "./music-player";

export const FAVOURITES_KEY = "focus-space-radio-favourites";
export const NO_COUNTRY = "Other";

export const isFavourite = (favourites: Station[], url: string): boolean =>
  favourites.some((station) => station.url === url);

// Adds the station, or removes it when it is already saved. A station is the same one by its stream address.
export function toggleFavourite(favourites: Station[], station: Station): Station[] {
  return isFavourite(favourites, station.url)
    ? favourites.filter((saved) => saved.url !== station.url)
    : [...favourites, station];
}

export interface CountryGroup {
  country: string;
  stations: Station[];
}

// "alphabetical" suits a saved list. "first-seen" keeps search results in the order they were ranked,
// so the country of the best match comes first. Stations without a country go last either way.
export function groupByCountry(stations: Station[], order: "alphabetical" | "first-seen"): CountryGroup[] {
  const groups = new Map<string, Station[]>();
  for (const station of stations) {
    const country = station.country || NO_COUNTRY;
    groups.set(country, [...(groups.get(country) ?? []), station]);
  }
  const result = [...groups].map(([country, list]) => ({
    country,
    stations: order === "alphabetical" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list,
  }));
  if (order === "alphabetical") result.sort((a, b) => a.country.localeCompare(b.country));
  return result.sort((a, b) => Number(a.country === NO_COUNTRY) - Number(b.country === NO_COUNTRY));
}

export function loadFavourites(storage: Pick<Storage, "getItem">): Station[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(FAVOURITES_KEY) ?? "null");
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    return saved.flatMap((station: Partial<Station> | null) => {
      if (typeof station?.name !== "string" || typeof station.url !== "string") return [];
      // Only https streams play from an https page, and a station is saved once.
      if (!station.url.startsWith("https://") || seen.has(station.url)) return [];
      seen.add(station.url);
      return [{
        name: station.name,
        url: station.url,
        ...(typeof station.country === "string" && station.country ? { country: station.country } : {}),
      }];
    });
  } catch {
    return [];
  }
}

export function saveFavourites(storage: Pick<Storage, "setItem">, favourites: Station[]): void {
  try {
    storage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
  } catch {
    // Storage may be unavailable or full; the saved list stays in memory until the page reloads.
  }
}
