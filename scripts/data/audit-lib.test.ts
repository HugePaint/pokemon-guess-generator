import { describe, expect, it } from "vitest";
import type { PokemonManifest } from "../../src/domain/pokemon";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import { auditManifest, printAuditReport } from "./audit-lib";

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

    expect(auditManifest(fallback, { omittedForms: ["25:missing:unspecified"] }))
      .toMatchObject({
        valid: true,
        omittedForms: ["25:missing:unspecified"],
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
    const report = auditManifest(fallback, { omittedForms: ["25:missing:unspecified"] });
    const warnings: string[] = [];
    const errors: string[] = [];

    printAuditReport(report, {
      warn: (message) => warnings.push(message),
      error: (message) => errors.push(message),
    });

    expect(warnings).toEqual([
      "警告：缺少可用精灵图的形态：25:missing:unspecified",
      "警告：形态使用英文名称回退：bulbasaur",
    ]);
    expect(errors).toEqual(["错误：未固定版本的精灵图 URL：https://example.com/25.png"]);
  });
});
