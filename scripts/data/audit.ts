import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PokemonManifestSchema } from "../../src/domain/pokemon";
import {
  AuditReportSchema,
  printAuditReport,
  validateAuditReport,
  type AuditOutput,
} from "./audit-lib";

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
    const reportFile = args[1];
    if (!reportFile) throw new Error("请提供要验证的 audit report 文件路径");
    const manifestText = await io.readText(file);
    const raw = JSON.parse(manifestText) as unknown;
    const parsed = PokemonManifestSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        io.error(`Manifest 格式无效：${issue.path.join(".")} ${issue.message}`);
      }
      return 1;
    }

    const reportRaw = JSON.parse(await io.readText(reportFile)) as unknown;
    const reportResult = AuditReportSchema.safeParse(reportRaw);
    if (!reportResult.success) {
      for (const issue of reportResult.error.issues) {
        io.error(`Audit report 格式无效：${issue.path.join(".")} ${issue.message}`);
      }
      return 1;
    }
    const report = reportResult.data;
    const integrityErrors = validateAuditReport(
      parsed.data,
      manifestText,
      report,
    );
    for (const message of integrityErrors) {
      io.error(message);
    }
    if (integrityErrors.length > 0) {
      return 1;
    }
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
