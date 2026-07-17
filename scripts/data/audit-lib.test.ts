import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import { auditManifest } from "./audit-lib";

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
});
