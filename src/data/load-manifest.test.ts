import { describe, expect, it, vi } from "vitest";
import { loadManifest } from "./load-manifest";
import { manifestFixture } from "../test/fixtures/pokemon-manifest";
import manifestJson from "../../public/data/pokemon.json";
import { PokemonManifestSchema } from "../domain/pokemon";

describe("loadManifest", () => {
  it("parses a valid manifest", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifestFixture)));
    await expect(loadManifest("/data/pokemon.json", fetcher)).resolves.toEqual(manifestFixture);
  });

  it("keeps the production JSON on commit-pinned sprite URLs", () => {
    const manifest = PokemonManifestSchema.parse(manifestJson);
    const imageCandidates = manifest.species.flatMap((species) =>
      species.forms.flatMap((form) => form.imageCandidates),
    );
    expect(imageCandidates.length).toBeGreaterThan(0);
    expect(
      imageCandidates.every((url) =>
        url.startsWith(
          "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@bf4c47ac82c33b330e33d98b8882d1cedb2f53e7/",
        ),
      ),
    ).toBe(true);
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
