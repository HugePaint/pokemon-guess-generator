import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../domain/pokemon";

export interface PokemonSelection {
  species: PokemonSpeciesRecord;
  form: PokemonFormRecord;
}

export function chooseRandomPokemon(
  records: PokemonSpeciesRecord[],
  rng: () => number = Math.random,
): PokemonSelection {
  if (records.length === 0) {
    throw new Error("没有可用的宝可梦");
  }

  const speciesIndex = Math.min(records.length - 1, Math.floor(rng() * records.length));
  const species = records[speciesIndex]!;
  const formIndex = Math.min(species.forms.length - 1, Math.floor(rng() * species.forms.length));
  const form = species.forms[formIndex]!;

  return { species, form };
}
