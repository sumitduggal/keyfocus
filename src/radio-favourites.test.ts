import { describe, expect, it } from "vitest";
import {
  FAVOURITES_KEY,
  NO_COUNTRY,
  groupByCountry,
  isFavourite,
  loadFavourites,
  saveFavourites,
  toggleFavourite,
} from "./radio-favourites";

const station = (name: string, country?: string) => ({ name, url: `https://radio.example/${name}`, country });

describe("favourites", () => {
  it("adds a station and removes it when toggled again", () => {
    const once = toggleFavourite([], station("Jazz"));
    expect(isFavourite(once, "https://radio.example/Jazz")).toBe(true);
    expect(toggleFavourite(once, station("Jazz"))).toEqual([]);
  });

  it("treats the same stream address as the same station", () => {
    const saved = toggleFavourite([], station("Jazz", "Spain"));
    expect(toggleFavourite(saved, { ...station("Jazz FM"), url: "https://radio.example/Jazz" })).toEqual([]);
  });
});

describe("grouping by country", () => {
  const list = [station("Zed", "Spain"), station("Alpha", "Brazil"), station("Mid"), station("Beta", "Spain")];

  it("sorts countries and stations alphabetically, with no-country last", () => {
    const groups = groupByCountry(list, "alphabetical");
    expect(groups.map((group) => group.country)).toEqual(["Brazil", "Spain", NO_COUNTRY]);
    expect(groups[1].stations.map((entry) => entry.name)).toEqual(["Beta", "Zed"]);
  });

  it("keeps ranked order when asked, still putting no-country last", () => {
    const groups = groupByCountry(list, "first-seen");
    expect(groups.map((group) => group.country)).toEqual(["Spain", "Brazil", NO_COUNTRY]);
    expect(groups[0].stations.map((entry) => entry.name)).toEqual(["Zed", "Beta"]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByCountry([], "alphabetical")).toEqual([]);
  });
});

describe("saving", () => {
  it("round trips the saved stations", () => {
    let saved = "";
    saveFavourites({ setItem: (_key, value) => (saved = value) }, [station("Jazz", "Spain"), station("Rock")]);
    expect(loadFavourites({ getItem: () => saved })).toEqual([
      { name: "Jazz", url: "https://radio.example/Jazz", country: "Spain" },
      { name: "Rock", url: "https://radio.example/Rock" },
    ]);
  });

  it("drops damaged, duplicate and non-https entries", () => {
    const raw = JSON.stringify([
      station("Jazz"),
      station("Jazz"),
      { name: "Plain", url: "http://radio.example/plain" },
      { name: 5, url: "https://radio.example/x" },
      null,
    ]);
    expect(loadFavourites({ getItem: (key) => (key === FAVOURITES_KEY ? raw : null) })).toHaveLength(1);
    for (const bad of ["{oops", "null", '"text"', '{"a":1}']) {
      expect(loadFavourites({ getItem: () => bad })).toEqual([]);
    }
    expect(loadFavourites({ getItem: () => null })).toEqual([]);
  });
});
