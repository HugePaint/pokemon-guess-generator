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

  it("excludes unavailable forms and species with no remaining forms", () => {
    const unavailable = new Set([
      manifestFixture.species[0].forms[0].id,
      manifestFixture.species[1].forms[1].id,
    ]);
    const values = [0, 0.99];

    const result = chooseRandomPokemon(
      manifestFixture.species,
      () => values.shift()!,
      unavailable,
    );

    expect(result.species.slug).toBe("pikachu");
    expect(result.form.slug).toBe("pikachu");
  });

  it("fails immediately when every form is unavailable", () => {
    const unavailable = new Set(
      manifestFixture.species.flatMap((species) =>
        species.forms.map((form) => form.id)
      ),
    );

    expect(() => chooseRandomPokemon(
      manifestFixture.species,
      () => {
        throw new Error("rng must not be called");
      },
      unavailable,
    )).toThrow("没有可用的宝可梦");
  });
});
