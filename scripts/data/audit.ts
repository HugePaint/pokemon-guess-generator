import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PokemonManifestSchema } from "../../src/domain/pokemon";
import { auditManifest, printAuditReport, type AuditOutput } from "./audit-lib";

export type AuditCliIo = AuditOutput & {
  readText(file: string): Promise<string>;
  log(message: string): void;
};

const defaultIo: AuditCliIo = {
  readText: (file) => readFile(file, "utf8"),
  log: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export async function runAuditCli(
  args: readonly string[],
  io: AuditCliIo = defaultIo,
): Promise<number> {
  try {
    const file = args[0];
    if (!file) throw new Error("请提供要审计的 manifest 文件路径");
    const raw = JSON.parse(await io.readText(file)) as unknown;
    const parsed = PokemonManifestSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        io.error(`Manifest 格式无效：${issue.path.join(".")} ${issue.message}`);
      }
      return 1;
    }

    const report = auditManifest(parsed.data);
    printAuditReport(report, io);
    if (!report.valid) return 1;
    io.log(`审计通过：${report.speciesCount} 个物种，${report.formCount} 个形态`);
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const scriptPath = process.argv[1];
if (scriptPath && resolve(scriptPath) === resolve(fileURLToPath(import.meta.url))) {
  void runAuditCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
