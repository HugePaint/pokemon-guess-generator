import { describe, expect, it } from "vitest";
import {
  legendaryModeAliasesFixture,
  speciesBundleFixture,
} from "../../src/test/fixtures/pokeapi";
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

  it("reports linked variety and pokemon-form aliases once under the variety identity", () => {
    expect(findOmittedFormIds(legendaryModeAliasesFixture)).toEqual([
      { id: "10264:koraidon-limited-build:unspecified", reason: "missing-image" },
      { id: "10265:koraidon-sprinting-build:unspecified", reason: "missing-image" },
      { id: "10266:koraidon-swimming-build:unspecified", reason: "missing-image" },
      { id: "10267:koraidon-gliding-build:unspecified", reason: "missing-image" },
      { id: "10268:miraidon-low-power-mode:unspecified", reason: "missing-image" },
      { id: "10269:miraidon-drive-mode:unspecified", reason: "missing-image" },
      { id: "10270:miraidon-aquatic-mode:unspecified", reason: "missing-image" },
      { id: "10271:miraidon-glide-mode:unspecified", reason: "missing-image" },
    ]);
  });

  it("keeps genuinely distinct omitted pokemon-forms", () => {
    const input = structuredClone(speciesBundleFixture);
    input.forms.push({
      ...input.forms[0]!,
      name: "pikachu-cap-original",
      form_name: "cap-original",
      sprites: { front_default: null },
    });
    input.forms[0]!.sprites.front_default = null;

    expect(findOmittedFormIds(input)).toEqual([
      { id: "25:cap-partner:unspecified", reason: "missing-image" },
      { id: "25:cap-original:unspecified", reason: "missing-image" },
    ]);
  });
});
