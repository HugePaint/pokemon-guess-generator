import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../domain/pokemon";

export interface PokemonSelection {
  species: PokemonSpeciesRecord;
  form: PokemonFormRecord;
}

export function chooseRandomPokemon(
  records: PokemonSpeciesRecord[],
  rng: () => number = Math.random,
  unavailableFormIds: ReadonlySet<string> = new Set(),
): PokemonSelection {
  const availableSpecies = records.flatMap((species) => {
    const forms = species.forms.filter((form) => !unavailableFormIds.has(form.id));
    return forms.length === 0 ? [] : [{ species, forms }];
  });
  if (availableSpecies.length === 0) {
    throw new Error("没有可用的宝可梦");
  }

  const speciesIndex = Math.min(
    availableSpecies.length - 1,
    Math.floor(rng() * availableSpecies.length),
  );
  const available = availableSpecies[speciesIndex]!;
  const formIndex = Math.min(
    available.forms.length - 1,
    Math.floor(rng() * available.forms.length),
  );
  const form = available.forms[formIndex]!;

  return { species: available.species, form };
}
