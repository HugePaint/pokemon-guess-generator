import type { PokemonManifest } from "../../src/domain/pokemon";
import { SPRITES_CDN_PREFIX } from "./source-config";

export type AuditOptions = {
  omittedForms?: string[];
  limit?: number;
};

export type AuditReport = {
  valid: boolean;
  speciesCount: number;
  formCount: number;
  duplicateSpeciesIds: number[];
  duplicateFormIds: string[];
  speciesMissingZhHans: number[];
  invalidSpriteUrls: string[];
  omittedForms: string[];
  englishNameFallbackForms: string[];
  limit?: number;
};

function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function auditManifest(manifest: PokemonManifest, options: AuditOptions = {}): AuditReport {
  const forms = manifest.species.flatMap((species) => species.forms);
  const duplicateSpeciesIds = duplicates(manifest.species.map((species) => species.id));
  const duplicateFormIds = duplicates(forms.map((form) => form.id));
  const speciesMissingZhHans = manifest.species
    .filter((species) => !species.names.zhHans)
    .map((species) => species.id);
  const invalidSpriteUrls = forms.flatMap((form) => form.imageCandidates)
    .filter((url) => !url.startsWith(SPRITES_CDN_PREFIX));
  const omittedForms = options.omittedForms ?? [];
  const englishNameFallbackForms = forms
    .filter((form) => !form.names.zhHans)
    .map((form) => form.id);

  return {
    valid: [
      duplicateSpeciesIds,
      duplicateFormIds,
      speciesMissingZhHans,
      invalidSpriteUrls,
    ].every((issues) => issues.length === 0),
    speciesCount: manifest.species.length,
    formCount: forms.length,
    duplicateSpeciesIds,
    duplicateFormIds,
    speciesMissingZhHans,
    invalidSpriteUrls,
    omittedForms,
    englishNameFallbackForms,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
  };
}
