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

export type AuditOutput = {
  warn(message: string): void;
  error(message: string): void;
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

export function printAuditReport(
  report: AuditReport,
  output: AuditOutput = console,
): void {
  for (const id of report.omittedForms) {
    output.warn(`警告：缺少可用精灵图的形态：${id}`);
  }
  for (const id of report.englishNameFallbackForms) {
    output.warn(`警告：形态使用英文名称回退：${id}`);
  }
  for (const id of report.duplicateSpeciesIds) {
    output.error(`错误：重复的物种 ID：${id}`);
  }
  for (const id of report.duplicateFormIds) {
    output.error(`错误：重复的形态 ID：${id}`);
  }
  for (const id of report.speciesMissingZhHans) {
    output.error(`错误：缺少简体中文名称的物种：${id}`);
  }
  for (const url of report.invalidSpriteUrls) {
    output.error(`错误：未固定版本的精灵图 URL：${url}`);
  }
}
