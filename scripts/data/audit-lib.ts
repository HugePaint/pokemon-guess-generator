import { createHash } from "node:crypto";
import { z } from "zod";
import type { PokemonManifest } from "../../src/domain/pokemon";
import { SPRITES_CDN_PREFIX } from "./source-config";
import type { OmittedForm } from "./normalize";

export type AuditOptions = {
  omittedForms?: OmittedForm[];
  limit?: number;
};

export type AuditFindings = {
  valid: boolean;
  speciesCount: number;
  formCount: number;
  duplicateSpeciesIds: number[];
  duplicateFormIds: string[];
  speciesMissingZhHans: number[];
  invalidSpriteUrls: string[];
  omittedForms: OmittedForm[];
  englishNameFallbackForms: string[];
  limit?: number;
};

const OmittedFormSchema = z.object({
  id: z.string().min(1),
  reason: z.enum([
    "missing-image",
    "missing-species-name",
    "unsupported-image-host",
    "invalid-form-relation",
  ]),
});

export const AuditReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  manifest: z.object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: z.string().datetime(),
    source: z.object({
      pokeApiBaseUrl: z.literal("https://pokeapi.co/api/v2"),
      spritesCommit: z.literal("bf4c47ac82c33b330e33d98b8882d1cedb2f53e7"),
    }),
  }),
  valid: z.boolean(),
  speciesCount: z.number().int().nonnegative(),
  formCount: z.number().int().nonnegative(),
  duplicateSpeciesIds: z.array(z.number().int().positive()),
  duplicateFormIds: z.array(z.string()),
  speciesMissingZhHans: z.array(z.number().int().positive()),
  invalidSpriteUrls: z.array(z.string()),
  omittedForms: z.array(OmittedFormSchema),
  englishNameFallbackForms: z.array(z.string()),
  limit: z.number().int().positive().optional(),
  reportSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type AuditReport = z.infer<typeof AuditReportSchema>;

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

export function auditManifest(
  manifest: PokemonManifest,
  options: AuditOptions = {},
): AuditFindings {
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

export function bindAuditReport(
  manifest: PokemonManifest,
  manifestText: string,
  options: AuditOptions = {},
): AuditReport {
  const reportBody = {
    schemaVersion: 1 as const,
    generatedAt: manifest.generatedAt,
    manifest: {
      sha256: sha256(manifestText),
      generatedAt: manifest.generatedAt,
      source: manifest.source,
    },
    ...auditManifest(manifest, options),
  };
  return AuditReportSchema.parse({
    ...reportBody,
    reportSha256: sha256(JSON.stringify(reportBody)),
  });
}

export function validateAuditReport(
  manifest: PokemonManifest,
  manifestText: string,
  report: AuditReport,
): string[] {
  const errors: string[] = [];
  if (report.manifest.sha256 !== sha256(manifestText)) {
    errors.push("审计报告对应的 Manifest SHA-256 不匹配");
  }
  if (
    report.generatedAt !== manifest.generatedAt
    || report.manifest.generatedAt !== manifest.generatedAt
    || JSON.stringify(report.manifest.source) !== JSON.stringify(manifest.source)
  ) {
    errors.push("审计报告中的 Manifest 来源元数据不匹配");
  }

  const { reportSha256, ...reportBody } = report;
  if (reportSha256 !== sha256(JSON.stringify(reportBody))) {
    errors.push("审计报告内容 SHA-256 不匹配");
  }

  const expected = auditManifest(manifest, {
    omittedForms: report.omittedForms,
    ...(report.limit === undefined ? {} : { limit: report.limit }),
  });
  for (const key of Object.keys(expected) as Array<keyof AuditFindings>) {
    if (JSON.stringify(report[key]) !== JSON.stringify(expected[key])) {
      errors.push(`审计报告字段与 Manifest 审计结果不匹配：${key}`);
    }
  }
  return errors;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function printAuditReport(
  report: AuditFindings,
  output: AuditOutput = console,
): void {
  for (const omitted of report.omittedForms) {
    output.warn(`警告：缺少可用精灵图的形态：${omitted.id}（${omitted.reason}）`);
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
