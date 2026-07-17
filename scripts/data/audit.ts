import { readFile } from "node:fs/promises";
import { PokemonManifestSchema } from "../../src/domain/pokemon";
import { auditManifest, type AuditReport } from "./audit-lib";

function printErrors(report: AuditReport): void {
  for (const id of report.duplicateSpeciesIds) console.error(`重复的物种 ID：${id}`);
  for (const id of report.duplicateFormIds) console.error(`重复的形态 ID：${id}`);
  for (const id of report.speciesMissingZhHans) console.error(`缺少简体中文名称的物种：${id}`);
  for (const url of report.invalidSpriteUrls) console.error(`未固定版本的精灵图 URL：${url}`);
  for (const id of report.omittedForms) console.error(`缺少可用精灵图的形态：${id}`);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error("请提供要审计的 manifest 文件路径");
  const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
  const parsed = PokemonManifestSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`Manifest 格式无效：${issue.path.join(".")} ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const report = auditManifest(parsed.data);
  if (!report.valid) {
    printErrors(report);
    process.exitCode = 1;
    return;
  }
  console.log(`审计通过：${report.speciesCount} 个物种，${report.formCount} 个形态`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
