import { describe, expect, it } from "vitest";
import { fetchJson, mapWithConcurrency } from "./pokeapi-client";

describe("fetchJson", () => {
  it("retries failed responses up to the configured bound", async () => {
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      if (attempts < 3) return new Response("", { status: 503, statusText: "Unavailable" });
      return new Response(JSON.stringify({ value: "ok" }), { status: 200 });
    };

    await expect(fetchJson<{ value: string }>(
      "https://pokeapi.co/api/v2/test-retry",
      fetcher as typeof fetch,
      { refresh: true, cacheDir: ".cache/pokeapi-test" },
    )).resolves.toEqual({ value: "ok" });
    expect(attempts).toBe(3);
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
