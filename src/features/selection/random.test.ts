import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { chooseRandomPokemon } from "./random";

describe("chooseRandomPokemon", () => {
  it("uses the first random value for species and second for that species form", () => {
    const values = [0.75, 0.99];
    const result = chooseRandomPokemon(manifestFixture.species, () => values.shift()!);

    expect(result.species.slug).toBe("pikachu");
    expect(result.form).toBe(result.species.forms.at(-1));
  });

  it("throws when no species are available", () => {
    expect(() => chooseRandomPokemon([])).toThrow("没有可用的宝可梦");
  });
});
