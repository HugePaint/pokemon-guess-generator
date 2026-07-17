import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { REQUEST_RETRIES } from "./source-config";

export type FetchJsonOptions = {
  refresh?: boolean;
  cacheDir?: string;
};

function cachePath(url: string, cacheDir: string): string {
  return join(cacheDir, `${createHash("sha256").update(url).digest("hex")}.json`);
}

const cacheWriteQueues = new Map<string, Promise<void>>();

export async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  const previous = cacheWriteQueues.get(file) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const tempFile = `${file}.tmp-${process.pid}-${randomUUID()}`;
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(tempFile, JSON.stringify(data), "utf8");
      await rename(tempFile, file);
    } finally {
      await rm(tempFile, { force: true });
    }
  });
  cacheWriteQueues.set(file, current);
  try {
    await current;
  } finally {
    if (cacheWriteQueues.get(file) === current) cacheWriteQueues.delete(file);
  }
}

export async function fetchJson<T>(
  url: string,
  fetcher: typeof fetch = fetch,
  options: FetchJsonOptions = {},
): Promise<T> {
  const file = cachePath(url, options.cacheDir ?? ".cache/pokeapi");
  if (!options.refresh) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {
      // A cache miss or corrupted entry is replaced by a fresh successful response.
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": "pokemon-guess-generator/0.1 (+GitHub repository)" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json() as T;
      await atomicWriteJson(file, data);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < REQUEST_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw new Error(`PokéAPI 请求失败：${url}`, { cause: lastError });
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("并发数必须是正整数");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
