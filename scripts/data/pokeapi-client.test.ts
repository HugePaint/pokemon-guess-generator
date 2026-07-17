import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteJson, fetchJson, mapWithConcurrency } from "./pokeapi-client";

const cacheDirectories: string[] = [];

async function createCacheDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pokemon-cache-"));
  cacheDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(cacheDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("fetchJson", () => {
  it("retries failed responses up to the configured bound", async () => {
    const cacheDir = await createCacheDirectory();
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      if (attempts < 3) return new Response("", { status: 503, statusText: "Unavailable" });
      return new Response(JSON.stringify({ value: "ok" }), { status: 200 });
    };

    await expect(fetchJson<{ value: string }>(
      "https://pokeapi.co/api/v2/test-retry",
      fetcher as typeof fetch,
      { refresh: true, cacheDir },
    )).resolves.toEqual({ value: "ok" });
    expect(attempts).toBe(3);
  });

  it("returns a successful cached response without fetching again", async () => {
    const cacheDir = await createCacheDirectory();
    const url = "https://pokeapi.co/api/v2/cache-hit";
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(JSON.stringify({ value: "cached" }), { status: 200 });
    };

    await fetchJson(url, fetcher as typeof fetch, { cacheDir });
    await expect(fetchJson(url, fetcher as typeof fetch, { cacheDir }))
      .resolves.toEqual({ value: "cached" });
    expect(calls).toBe(1);
  });

  it("bypasses an existing cache entry when refresh is enabled", async () => {
    const cacheDir = await createCacheDirectory();
    const url = "https://pokeapi.co/api/v2/cache-refresh";
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(JSON.stringify({ value: calls }), { status: 200 });
    };

    await fetchJson(url, fetcher as typeof fetch, { cacheDir });
    await expect(fetchJson(url, fetcher as typeof fetch, { cacheDir, refresh: true }))
      .resolves.toEqual({ value: 2 });
    expect(calls).toBe(2);
  });

  it("recovers from corrupt cache JSON with a fresh response", async () => {
    const cacheDir = await createCacheDirectory();
    const url = "https://pokeapi.co/api/v2/cache-corrupt";
    const fetcher = async () =>
      new Response(JSON.stringify({ value: "fresh" }), { status: 200 });

    await fetchJson(url, fetcher as typeof fetch, { cacheDir });
    const [cacheFile] = await readdir(cacheDir);
    await writeFile(join(cacheDir, cacheFile!), "{broken", "utf8");

    await expect(fetchJson(url, fetcher as typeof fetch, { cacheDir }))
      .resolves.toEqual({ value: "fresh" });
  });

  it("keeps concurrent same-URL cache writes valid and cleans unique temps", async () => {
    const cacheDir = await createCacheDirectory();
    const cacheFile = join(cacheDir, "shared.json");

    await Promise.all([
      atomicWriteJson(cacheFile, { writer: 1 }),
      atomicWriteJson(cacheFile, { writer: 2 }),
    ]);

    expect([{ writer: 1 }, { writer: 2 }]).toContainEqual(
      JSON.parse(await readFile(cacheFile, "utf8")),
    );
    expect(await readdir(cacheDir)).toEqual(["shared.json"]);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves input order while bounding active operations", async () => {
    let active = 0;
    let highestActive = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      highestActive = Math.max(highestActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([2, 4, 6, 8]);
    expect(highestActive).toBe(2);
  });
});
