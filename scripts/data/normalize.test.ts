import { describe, expect, it } from "vitest";
import { speciesBundleFixture } from "../../src/test/fixtures/pokeapi";
import { findOmittedFormIds, normalizeSpecies, pinSpriteUrl } from "./normalize";

describe("pinSpriteUrl", () => {
  it("rewrites master raw URLs to the pinned jsDelivr commit", () => {
    expect(pinSpriteUrl(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    )).toBe(
      "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@bf4c47ac82c33b330e33d98b8882d1cedb2f53e7/sprites/pokemon/25.png",
    );
  });
});

describe("normalizeSpecies", () => {
  it("creates a female record only when a female sprite exists", () => {
    const record = normalizeSpecies(speciesBundleFixture);
    expect(record.forms.some((form) => form.gender === "female")).toBe(true);
  });

  it("reads PokéAPI's lowercase zh-hans language identifier", () => {
    const input = structuredClone(speciesBundleFixture);
    input.species.names[0]!.language.name = "zh-hans";
    expect(normalizeSpecies(input).names.zhHans).toBe("皮卡丘");
  });

  it("does not use a base image for a cosmetic form", () => {
    const record = normalizeSpecies(speciesBundleFixture);
    const cosmetic = record.forms.find((form) => form.flags.isCosmetic);
    expect(cosmetic?.imageCandidates).toEqual([
      expect.stringContaining("/sprites/pokemon/other/showdown/25-cap-partner.png"),
    ]);
  });

  it("reports omitted forms with a machine-readable reason", () => {
    const input = structuredClone(speciesBundleFixture);
    input.forms[0]!.sprites.front_default = null;
    expect(findOmittedFormIds(input)).toEqual([
      { id: "25:cap-partner:unspecified", reason: "missing-image" },
    ]);
  });
});
