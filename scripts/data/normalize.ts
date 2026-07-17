import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../src/domain/pokemon";
import { SPRITES_CDN_PREFIX } from "./source-config";

const RAW_SPRITES_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master/";

type LocalizedName = { language: { name: string }; name: string };
type SpriteSet = {
  front_default: string | null;
  front_female?: string | null;
  other?: {
    home?: { front_default?: string | null; front_female?: string | null };
    "official-artwork"?: { front_default?: string | null };
  };
};
type PokemonResource = { id: number; name: string; sprites: SpriteSet };
type PokemonFormResource = {
  name: string;
  form_name: string;
  is_default: boolean;
  is_mega: boolean;
  is_battle_only: boolean;
  pokemon: { name: string };
  names: readonly LocalizedName[];
  sprites: { front_default: string | null };
};

export type SpeciesBundle = {
  species: {
    id: number;
    name: string;
    names: readonly LocalizedName[];
    varieties: readonly { is_default: boolean; pokemon: { name: string } }[];
  };
  pokemon: PokemonResource;
  varietyPokemon?: readonly PokemonResource[];
  forms: readonly PokemonFormResource[];
};

export type OmittedForm = {
  id: string;
  reason: "missing-image" | "missing-species-name" | "unsupported-image-host" | "invalid-form-relation";
};

export function pinSpriteUrl(url: string): string {
  if (!url.startsWith(RAW_SPRITES_PREFIX)) {
    throw new Error(`不支持的精灵图 URL：${url}`);
  }
  return `${SPRITES_CDN_PREFIX}${url.slice(RAW_SPRITES_PREFIX.length)}`;
}

function localizedNames(names: readonly LocalizedName[], fallback: string) {
  return {
    zhHans: names.find((entry) => entry.language.name.toLowerCase() === "zh-hans")?.name,
    en: names.find((entry) => entry.language.name === "en")?.name ?? fallback,
  };
}

function pinnedCandidates(urls: Array<string | null | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)).map(pinSpriteUrl))];
}

function flagsFor(form: PokemonFormResource | undefined) {
  return {
    isMega: form?.is_mega ?? false,
    isBattleOnly: form?.is_battle_only ?? false,
    isCosmetic: false,
  };
}

function compareForms(left: PokemonFormRecord, right: PokemonFormRecord): number {
  if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
  const bySlug = left.slug.localeCompare(right.slug);
  return bySlug || left.gender.localeCompare(right.gender);
}

function omissionIdentity(
  pokemon: PokemonResource,
  form?: PokemonFormResource,
): { sourceKey: string; id: string } {
  const isPokemonAlias = form === undefined || form.name === pokemon.name;
  return {
    sourceKey: isPokemonAlias ? `pokemon:${pokemon.name}` : `pokemon-form:${form.name}`,
    id: `${pokemon.id}:${
      isPokemonAlias ? pokemon.name : form.form_name || form.name
    }:unspecified`,
  };
}

export function findOmittedFormIds(input: SpeciesBundle): OmittedForm[] {
  const varieties = input.varietyPokemon ?? [input.pokemon];
  const omitted: OmittedForm[] = [];
  const omittedSourceKeys = new Set<string>();
  const recordMissingImage = (identity: { sourceKey: string; id: string }) => {
    if (omittedSourceKeys.has(identity.sourceKey)) return;
    omittedSourceKeys.add(identity.sourceKey);
    omitted.push({ id: identity.id, reason: "missing-image" });
  };

  for (const pokemon of varieties) {
    if (pinnedCandidates([
      pokemon.sprites.other?.["official-artwork"]?.front_default,
      pokemon.sprites.other?.home?.front_default,
      pokemon.sprites.front_default,
    ]).length === 0) {
      recordMissingImage(omissionIdentity(pokemon));
    }
  }

  const knownPokemonNames = new Set(varieties.map((pokemon) => pokemon.name));
  for (const form of input.forms) {
    if (
      !form.is_default
      && knownPokemonNames.has(form.pokemon.name)
      && pinnedCandidates([form.sprites.front_default]).length === 0
    ) {
      const pokemon = varieties.find((entry) => entry.name === form.pokemon.name);
      if (pokemon) recordMissingImage(omissionIdentity(pokemon, form));
    }
  }
  return omitted;
}

export function normalizeSpecies(input: SpeciesBundle): PokemonSpeciesRecord {
  const speciesNames = localizedNames(input.species.names, input.species.name);
  if (!speciesNames.zhHans) {
    throw new Error(`缺少简体中文名称：${input.species.name}`);
  }

  const varieties = input.varietyPokemon ?? [input.pokemon];
  const forms: PokemonFormRecord[] = [];

  for (const pokemon of varieties) {
    const variety = input.species.varieties.find((entry) => entry.pokemon.name === pokemon.name);
    const formResource = input.forms.find(
      (form) => form.pokemon.name === pokemon.name && form.is_default,
    );
    const formNames = formResource?.form_name
      ? localizedNames(formResource.names, pokemon.name)
      : speciesNames;
    const defaultCandidates = pinnedCandidates([
      pokemon.sprites.other?.["official-artwork"]?.front_default,
      pokemon.sprites.other?.home?.front_default,
      pokemon.sprites.front_default,
    ]);

    if (defaultCandidates.length > 0) {
      forms.push({
        id: `${pokemon.id}:${pokemon.name}:unspecified`,
        slug: pokemon.name,
        names: formNames,
        isDefault: variety?.is_default ?? pokemon.name === input.pokemon.name,
        gender: "unspecified",
        flags: flagsFor(formResource),
        imageCandidates: defaultCandidates,
      });
    }

    const femaleCandidates = pinnedCandidates([
      pokemon.sprites.other?.home?.front_female,
      pokemon.sprites.front_female,
    ]);
    if (femaleCandidates.length > 0) {
      forms.push({
        id: `${pokemon.id}:${pokemon.name}:female`,
        slug: pokemon.name,
        names: formNames,
        isDefault: false,
        gender: "female",
        flags: flagsFor(formResource),
        imageCandidates: femaleCandidates,
      });
    }
  }

  const knownPokemonNames = new Set(varieties.map((pokemon) => pokemon.name));
  for (const form of input.forms) {
    if (form.is_default || !knownPokemonNames.has(form.pokemon.name)) continue;
    const imageCandidates = pinnedCandidates([form.sprites.front_default]);
    if (imageCandidates.length === 0) continue;
    const pokemon = varieties.find((entry) => entry.name === form.pokemon.name);
    forms.push({
      id: `${pokemon?.id ?? input.species.id}:${form.form_name || form.name}:unspecified`,
      slug: form.name,
      names: localizedNames(form.names, form.name),
      isDefault: false,
      gender: "unspecified",
      flags: {
        isMega: form.is_mega,
        isBattleOnly: form.is_battle_only,
        isCosmetic: true,
      },
      imageCandidates,
    });
  }

  return {
    id: input.species.id,
    slug: input.species.name,
    names: speciesNames as { zhHans: string; en: string },
    forms: forms.sort(compareForms),
  };
}
