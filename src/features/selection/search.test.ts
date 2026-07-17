import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { searchSpecies } from "./search";
import type { PokemonSpeciesRecord } from "../../domain/pokemon";

describe("searchSpecies", () => {
  it.each(["妙蛙种子", "bulbasaur", "0001", "1"])("finds by %s", (query) => {
    expect(searchSpecies(manifestFixture.species, query)[0]?.slug).toBe("bulbasaur");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(searchSpecies(manifestFixture.species, "  PIKA  ")[0]?.slug).toBe("pikachu");
  });

  it("sorts prefix matches before substring matches", () => {
    const records: PokemonSpeciesRecord[] = [
      manifestFixture.species[1],
      {
        ...manifestFixture.species[0],
        slug: "kadabra",
        names: { zhHans: "勇基拉", en: "Kadabra" },
      },
    ];

    const result = searchSpecies(records, "ka");
    expect(result.map((species) => species.slug)).toEqual(["kadabra", "pikachu"]);
  });

  it("returns all records when query is empty after trim", () => {
    expect(searchSpecies(manifestFixture.species, "   ")).toEqual(manifestFixture.species);
  });
});
