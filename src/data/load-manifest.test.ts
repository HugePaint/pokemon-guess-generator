import { describe, expect, it, vi } from "vitest";
import { loadManifest } from "./load-manifest";
import { manifestFixture } from "../test/fixtures/pokemon-manifest";

describe("loadManifest", () => {
  it("parses a valid manifest", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifestFixture)));
    await expect(loadManifest("/data/pokemon.json", fetcher)).resolves.toEqual(manifestFixture);
  });

  it("reports an invalid manifest instead of returning partial data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"schemaVersion":1,"species":[]}'));
    await expect(loadManifest("/data/pokemon.json", fetcher)).rejects.toThrow("图鉴数据格式无效");
  });

  it("reports an HTTP failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(loadManifest("/data/pokemon.json", fetcher)).rejects.toThrow("图鉴数据加载失败：503");
  });
});
