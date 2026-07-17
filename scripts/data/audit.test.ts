import { describe, expect, it } from "vitest";
import type { PokemonManifest } from "../../src/domain/pokemon";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import { runAuditCli, type AuditCliIo } from "./audit";

function collectingIo(json: unknown) {
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const io: AuditCliIo = {
    readText: async () => JSON.stringify(json),
    log: (message) => logs.push(message),
    warn: (message) => warnings.push(message),
    error: (message) => errors.push(message),
  };
  return { io, logs, warnings, errors };
}

describe("runAuditCli", () => {
  it("returns exit 0 and prints warning-only findings", async () => {
    const fallback = structuredClone(manifestFixture) as unknown as PokemonManifest;
    delete fallback.species[0]!.forms[0]!.names.zhHans;
    const output = collectingIo(fallback);

    await expect(runAuditCli(["manifest.json"], output.io)).resolves.toBe(0);
    expect(output.warnings).toEqual(["警告：形态使用英文名称回退：bulbasaur"]);
    expect(output.errors).toEqual([]);
    expect(output.logs).toEqual(["审计通过：2 个物种，3 个形态"]);
  });

  it("returns exit 1 and prints blocking findings as errors", async () => {
    const invalid = structuredClone(manifestFixture) as unknown as PokemonManifest;
    invalid.species[0]!.forms[0]!.imageCandidates = ["https://example.com/1.png"];
    const output = collectingIo(invalid);

    await expect(runAuditCli(["manifest.json"], output.io)).resolves.toBe(1);
    expect(output.warnings).toEqual([]);
    expect(output.errors).toEqual([
      "错误：未固定版本的精灵图 URL：https://example.com/1.png",
    ]);
    expect(output.logs).toEqual([]);
  });
});
