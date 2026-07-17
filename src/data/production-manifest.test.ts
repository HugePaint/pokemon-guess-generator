import { describe, expect, it } from "vitest";
import manifestJson from "../../public/data/pokemon.json";
import { PokemonManifestSchema } from "../domain/pokemon";
import { chooseRandomPokemon } from "../features/selection/random";

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
}

describe("production manifest", () => {
  it("parses and always returns a form owned by the selected species", () => {
    const manifest = PokemonManifestSchema.parse(manifestJson);
    const rng = seededRandom(20260717);
    for (let index = 0; index < 10_000; index += 1) {
      const selection = chooseRandomPokemon(manifest.species, rng);
      expect(selection.species.forms).toContain(selection.form);
    }
  });
});
