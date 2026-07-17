import { describe, expect, it } from "vitest";
import type { PokemonManifest } from "../../src/domain/pokemon";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import { bindAuditReport } from "./audit-lib";
import { runAuditCli, type AuditCliIo } from "./audit";

function collectingIo(manifest: unknown, report: unknown) {
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const io: AuditCliIo = {
    readText: async (file) => JSON.stringify(
      file.includes("audit") ? report : manifest,
      null,
      2,
    ),
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
    const manifestText = JSON.stringify(fallback, null, 2);
    const report = bindAuditReport(fallback, manifestText);
    const output = collectingIo(fallback, report);

    await expect(runAuditCli(
      ["manifest.json", "audit-report.json"],
      output.io,
    )).resolves.toBe(0);
    expect(output.warnings).toEqual(["警告：形态使用英文名称回退：bulbasaur"]);
    expect(output.errors).toEqual([]);
    expect(output.logs).toEqual(["审计通过：2 个物种，3 个形态"]);
  });

  it("returns exit 1 and prints blocking findings as errors", async () => {
    const invalid = structuredClone(manifestFixture) as unknown as PokemonManifest;
    invalid.species[0]!.forms[0]!.imageCandidates = ["https://example.com/1.png"];
    const manifestText = JSON.stringify(invalid, null, 2);
    const report = bindAuditReport(invalid, manifestText);
    const output = collectingIo(invalid, report);

    await expect(runAuditCli(
      ["manifest.json", "audit-report.json"],
      output.io,
    )).resolves.toBe(1);
    expect(output.warnings).toEqual([]);
    expect(output.errors).toEqual([
      "错误：未固定版本的精灵图 URL：https://example.com/1.png",
    ]);
    expect(output.logs).toEqual([]);
  });

  it("rejects stale or edited audit reports", async () => {
    const manifest = manifestFixture as PokemonManifest;
    const manifestText = JSON.stringify(manifest, null, 2);
    const stale = bindAuditReport(manifest, `${manifestText}\n`);
    const staleOutput = collectingIo(manifest, stale);

    await expect(runAuditCli(
      ["manifest.json", "audit-report.json"],
      staleOutput.io,
    )).resolves.toBe(1);
    expect(staleOutput.errors).toContain(
      "审计报告对应的 Manifest SHA-256 不匹配",
    );

    const edited = {
      ...bindAuditReport(manifest, manifestText),
      speciesCount: 999,
    };
    const editedOutput = collectingIo(manifest, edited);
    await expect(runAuditCli(
      ["manifest.json", "audit-report.json"],
      editedOutput.io,
    )).resolves.toBe(1);
    expect(editedOutput.errors).toContain("审计报告内容 SHA-256 不匹配");
  });
});
