import type { PokemonSpeciesRecord } from "../../domain/pokemon";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNumericId(value: string): string {
  return String(Number(value));
}

export function searchSpecies(
  speciesRecords: PokemonSpeciesRecord[],
  query: string,
): PokemonSpeciesRecord[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return speciesRecords;
  }

  const normalizedQuery = normalizeText(trimmedQuery);
  const isNumericQuery = /^\d+$/.test(trimmedQuery);
  const normalizedId = isNumericQuery ? normalizeNumericId(trimmedQuery) : "";

  const matches = speciesRecords
    .map((species, index) => {
      const candidateTexts = [species.slug, species.names.en, species.names.zhHans].map(normalizeText);
      const idText = String(species.id);
      const isIdExactMatch = isNumericQuery && idText === normalizedId;
      const hasPrefixMatch = candidateTexts.some((candidate) => candidate.startsWith(normalizedQuery));
      const hasSubstringMatch = candidateTexts.some((candidate) => candidate.includes(normalizedQuery));

      if (!isIdExactMatch && !hasPrefixMatch && !hasSubstringMatch) {
        return null;
      }

      const rank = isIdExactMatch ? 0 : hasPrefixMatch ? 1 : 2;
      return { species, index, rank };
    })
    .filter((entry): entry is { species: PokemonSpeciesRecord; index: number; rank: number } => entry !== null);

  matches.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return matches.map((entry) => entry.species);
}
