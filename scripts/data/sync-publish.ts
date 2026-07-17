import { access, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type PublishFileOperations = {
  rename: typeof rename;
  writeFile: typeof writeFile;
};

const defaultOperations: PublishFileOperations = { rename, writeFile };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeIfPresent(path: string): Promise<void> {
  await rm(path, { force: true });
}

export async function publishJsonPair(
  manifestFile: string,
  manifestJson: string,
  auditFile: string,
  auditJson: string,
  overrides: Partial<PublishFileOperations> = {},
): Promise<void> {
  const operations = { ...defaultOperations, ...overrides };
  const token = `${process.pid}-${randomUUID()}`;
  const manifestTemp = `${manifestFile}.tmp-${token}`;
  const auditTemp = `${auditFile}.tmp-${token}`;
  const manifestBackup = `${manifestFile}.backup-${token}`;
  const auditBackup = `${auditFile}.backup-${token}`;
  let manifestBackedUp = false;
  let auditBackedUp = false;
  let manifestPublished = false;
  let auditPublished = false;

  try {
    await operations.writeFile(manifestTemp, manifestJson, "utf8");
    await operations.writeFile(auditTemp, auditJson, "utf8");

    if (await exists(manifestFile)) {
      await operations.rename(manifestFile, manifestBackup);
      manifestBackedUp = true;
    }
    if (await exists(auditFile)) {
      await operations.rename(auditFile, auditBackup);
      auditBackedUp = true;
    }

    await operations.rename(manifestTemp, manifestFile);
    manifestPublished = true;
    await operations.rename(auditTemp, auditFile);
    auditPublished = true;

    await Promise.all([
      removeIfPresent(manifestBackup),
      removeIfPresent(auditBackup),
    ]);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    const rollback = async (action: () => Promise<void>): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
        return false;
      }
    };

    if (manifestPublished) await rollback(() => removeIfPresent(manifestFile));
    if (auditPublished) await rollback(() => removeIfPresent(auditFile));
    if (manifestBackedUp) {
      if (await rollback(() => operations.rename(manifestBackup, manifestFile))) {
        manifestBackedUp = false;
      }
    }
    if (auditBackedUp) {
      if (await rollback(() => operations.rename(auditBackup, auditFile))) {
        auditBackedUp = false;
      }
    }

    await Promise.all([
      removeIfPresent(manifestTemp),
      removeIfPresent(auditTemp),
      ...(manifestBackedUp ? [] : [removeIfPresent(manifestBackup)]),
      ...(auditBackedUp ? [] : [removeIfPresent(auditBackup)]),
    ]);

    if (rollbackErrors.length > 0) {
      const retainedBackups = [
        ...(manifestBackedUp ? [manifestBackup] : []),
        ...(auditBackedUp ? [auditBackup] : []),
      ];
      throw new AggregateError(
        [error, ...rollbackErrors],
        `发布失败且无法完整恢复原有数据；保留的备份：${retainedBackups.join("，")}`,
      );
    }
    throw error;
  }
}
