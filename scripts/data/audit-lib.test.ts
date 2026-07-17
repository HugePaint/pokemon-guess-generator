import { describe, expect, it } from "vitest";
import type { PokemonManifest } from "../../src/domain/pokemon";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import {
  AuditReportSchema,
  auditManifest,
  bindAuditReport,
  printAuditReport,
  validateAuditReport,
} from "./audit-lib";

describe("auditManifest", () => {
  it("accepts a valid manifest and reports counts", () => {
    expect(auditManifest(manifestFixture)).toMatchObject({
      valid: true,
      duplicateSpeciesIds: [],
      duplicateFormIds: [],
      speciesCount: 2,
    });
  });

  it("rejects duplicate species IDs", () => {
    const duplicate = {
      ...manifestFixture,
      species: [...manifestFixture.species, manifestFixture.species[0]!],
    };
    expect(auditManifest(duplicate).valid).toBe(false);
  });

  it("reports omitted and English fallback forms without invalidating publication", () => {
    const fallback = structuredClone(manifestFixture) as unknown as PokemonManifest;
    delete fallback.species[0]!.forms[0]!.names.zhHans;

    expect(auditManifest(fallback, {
      omittedForms: [{ id: "25:missing:unspecified", reason: "missing-image" }],
    }))
      .toMatchObject({
        valid: true,
        omittedForms: [{ id: "25:missing:unspecified", reason: "missing-image" }],
        englishNameFallbackForms: ["bulbasaur"],
      });
  });

  it("invalidates non-pinned sprite URLs", () => {
    const invalid = structuredClone(manifestFixture) as unknown as PokemonManifest;
    invalid.species[0]!.forms[0]!.imageCandidates = [
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
    ];

    expect(auditManifest(invalid)).toMatchObject({
      valid: false,
      invalidSpriteUrls: [
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
      ],
    });
  });

  it("prints report-only findings as warnings and invalid findings as errors", () => {
    const fallback = structuredClone(manifestFixture) as unknown as PokemonManifest;
    delete fallback.species[0]!.forms[0]!.names.zhHans;
    fallback.species[1]!.forms[0]!.imageCandidates = ["https://example.com/25.png"];
    const report = auditManifest(fallback, {
      omittedForms: [{ id: "25:missing:unspecified", reason: "missing-image" }],
    });
    const warnings: string[] = [];
    const errors: string[] = [];

    printAuditReport(report, {
      warn: (message) => warnings.push(message),
      error: (message) => errors.push(message),
    });

    expect(warnings).toEqual([
      "警告：缺少可用精灵图的形态：25:missing:unspecified（missing-image）",
      "警告：形态使用英文名称回退：bulbasaur",
    ]);
    expect(errors).toEqual(["错误：未固定版本的精灵图 URL：https://example.com/25.png"]);
  });

  it("schema-validates and binds a report to the exact manifest text", () => {
    const manifest = manifestFixture as PokemonManifest;
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const report = bindAuditReport(manifest, manifestText, {
      omittedForms: [{ id: "25:missing:unspecified", reason: "missing-image" }],
    });

    expect(AuditReportSchema.parse(report)).toEqual(report);
    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt: manifest.generatedAt,
      manifest: {
        generatedAt: manifest.generatedAt,
        source: manifest.source,
      },
    });
    expect(report.manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.reportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateAuditReport(manifest, manifestText, report)).toEqual([]);
  });

  it("detects stale manifests and edited report fields", () => {
    const manifest = manifestFixture as PokemonManifest;
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const report = bindAuditReport(manifest, manifestText);

    expect(validateAuditReport(
      manifest,
      `${manifestText}\n`,
      report,
    )).toContain("审计报告对应的 Manifest SHA-256 不匹配");
    expect(validateAuditReport(manifest, manifestText, {
      ...report,
      formCount: report.formCount + 1,
    })).toContain("审计报告内容 SHA-256 不匹配");
  });
});
