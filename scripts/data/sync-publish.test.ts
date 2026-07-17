import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { publishJsonPair } from "./sync-publish";

const createdDirectories: string[] = [];

async function createOutputPair() {
  const directory = await mkdtemp(join(tmpdir(), "pokemon-sync-publish-"));
  createdDirectories.push(directory);
  const manifestFile = join(directory, "pokemon.json");
  const auditFile = join(directory, "audit-report.json");
  await writeFile(manifestFile, "old manifest", "utf8");
  await writeFile(auditFile, "old audit", "utf8");
  return { directory, manifestFile, auditFile };
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("publishJsonPair", () => {
  it("restores both prior files when the second final rename fails", async () => {
    const files = await createOutputPair();
    const failingRename: typeof rename = async (oldPath, newPath) => {
      if (
        String(oldPath).includes(".tmp-")
        && String(newPath) === files.auditFile
      ) {
        throw new Error("simulated audit rename failure");
      }
      await rename(oldPath, newPath);
    };

    await expect(publishJsonPair(
      files.manifestFile,
      "new manifest",
      files.auditFile,
      "new audit",
      { rename: failingRename },
    )).rejects.toThrow("simulated audit rename failure");

    expect(await readFile(files.manifestFile, "utf8")).toBe("old manifest");
    expect(await readFile(files.auditFile, "utf8")).toBe("old audit");
    expect(await readdir(files.directory)).toEqual(["audit-report.json", "pokemon.json"]);
  });

  it("leaves both prior files untouched when a temporary write fails", async () => {
    const files = await createOutputPair();
    let writes = 0;
    const failingWrite: typeof writeFile = async (...args) => {
      writes += 1;
      if (writes === 2) throw new Error("simulated audit write failure");
      return writeFile(...args);
    };

    await expect(publishJsonPair(
      files.manifestFile,
      "new manifest",
      files.auditFile,
      "new audit",
      { writeFile: failingWrite },
    )).rejects.toThrow("simulated audit write failure");

    expect(await readFile(files.manifestFile, "utf8")).toBe("old manifest");
    expect(await readFile(files.auditFile, "utf8")).toBe("old audit");
    expect(await readdir(files.directory)).toEqual(["audit-report.json", "pokemon.json"]);
  });

  it("retains and identifies a backup when its restore rename fails", async () => {
    const files = await createOutputPair();
    const failingRename: typeof rename = async (oldPath, newPath) => {
      const oldName = String(oldPath);
      if (oldName.includes(".tmp-") && String(newPath) === files.auditFile) {
        throw new Error("simulated publish failure");
      }
      if (oldName.includes("pokemon.json.backup-") && String(newPath) === files.manifestFile) {
        throw new Error("simulated restore failure");
      }
      await rename(oldPath, newPath);
    };

    let thrown: unknown;
    try {
      await publishJsonPair(
        files.manifestFile,
        "new manifest",
        files.auditFile,
        "new audit",
        { rename: failingRename },
      );
    } catch (error) {
      thrown = error;
    }

    const backupName = (await readdir(files.directory))
      .find((name) => name.startsWith("pokemon.json.backup-"));
    expect(backupName).toBeDefined();
    const backupPath = join(files.directory, backupName!);
    expect(await readFile(backupPath, "utf8")).toBe("old manifest");
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as Error).message).toContain(backupPath);
    expect(await readFile(files.auditFile, "utf8")).toBe("old audit");
  });
});
