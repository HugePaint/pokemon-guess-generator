import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PokemonManifest } from "../../domain/pokemon";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import type { CropTransform } from "../rendering/types";
import { useGenerator, type GeneratorDependencies } from "./use-generator";
import { useManifest } from "./use-manifest";

const imageFixture = {
  naturalWidth: 200,
  naturalHeight: 100,
} as HTMLImageElement;

const initialCrop: CropTransform = {
  scale: 3,
  offsetX: 10,
  offsetY: 20,
  fallback: false,
};

function createDependencies(
  overrides: Partial<GeneratorDependencies> = {},
): GeneratorDependencies {
  return {
    rng: () => 0.5,
    loadImage: vi.fn().mockResolvedValue(imageFixture),
    createCrop: vi.fn().mockReturnValue(initialCrop),
    exportJpeg: vi.fn().mockResolvedValue({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      filename: "pokemon.jpg",
    }),
    ...overrides,
  };
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

describe("useGenerator", () => {
  it("randomizes species first and enables both downloads after image load", async () => {
    const dependencies = createDependencies({
      rng: sequenceRng([0.75, 0.99]),
    });
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      dependencies,
    ));

    await act(async () => {
      await result.current.randomize();
    });

    expect(result.current.selection?.species.slug).toBe("pikachu");
    expect(result.current.selection?.form.slug).toBe("pikachu-rock-star");
    expect(result.current.status.type).toBe("ready");
    expect(result.current.canDownload).toBe(true);
  });

  it("preserves the selection when search has no results", async () => {
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies(),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    const selection = result.current.selection;

    act(() => result.current.setSearch("missing"));

    expect(result.current.selection).toEqual(selection);
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchMessage).toBe("未找到匹配的宝可梦");
  });

  it("switches modes, regenerates crops, drags and clamps zoom", async () => {
    const regeneratedCrop = {
      scale: 4,
      offsetX: -30,
      offsetY: -40,
      fallback: false,
    };
    const createCrop = vi.fn()
      .mockReturnValueOnce(initialCrop)
      .mockReturnValueOnce(regeneratedCrop);
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({ createCrop }),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[1]);
    });

    act(() => result.current.setMode("crop"));
    expect(result.current.mode).toBe("crop");
    expect(result.current.crop).toEqual(initialCrop);

    act(() => result.current.randomizeCrop());
    expect(result.current.crop).toEqual(regeneratedCrop);

    act(() => result.current.dragCrop(12, -8));
    expect(result.current.crop).toMatchObject({ offsetX: -18, offsetY: -48 });

    act(() => result.current.setZoom(99));
    expect(result.current.zoom).toBe(3);
    expect(result.current.crop?.scale).toBeCloseTo(4.8);

    act(() => result.current.setZoom(0));
    expect(result.current.zoom).toBe(1.5);
    expect(result.current.crop?.scale).toBeCloseTo(2.4);

    act(() => result.current.setMode("silhouette"));
    expect(result.current.mode).toBe("silhouette");
  });

  it("keeps the failed selection and retries image loading", async () => {
    const loadImage = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(imageFixture);
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({ loadImage }),
    ));

    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    expect(result.current.status).toEqual({
      type: "error",
      message: "图片加载失败，请重试",
    });
    expect(result.current.selection?.species.slug).toBe("bulbasaur");
    expect(result.current.canDownload).toBe(false);

    await act(async () => {
      await result.current.retryImage();
    });
    expect(result.current.status.type).toBe("ready");
    expect(loadImage).toHaveBeenCalledTimes(2);
  });

  it("changes forms and preview tabs without changing species", async () => {
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies(),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[1]);
    });
    await act(async () => {
      await result.current.selectForm(manifestFixture.species[1].forms[1]);
    });
    act(() => result.current.setPreviewKind("answer"));

    expect(result.current.selection?.species.slug).toBe("pikachu");
    expect(result.current.selection?.form.slug).toBe("pikachu-rock-star");
    expect(result.current.previewKind).toBe("answer");
  });

  it("exports each JPEG and reports an export error without losing readiness", async () => {
    const exportJpeg = vi.fn()
      .mockResolvedValueOnce({
        blob: new Blob(["question"], { type: "image/jpeg" }),
        filename: "question.jpg",
      })
      .mockRejectedValueOnce(new Error("canvas failed"));
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({ exportJpeg }),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    const canvas = document.createElement("canvas");

    await act(async () => {
      await expect(result.current.exportQuestion(canvas)).resolves.toMatchObject({
        filename: "question.jpg",
      });
      await expect(result.current.exportAnswer(canvas)).rejects.toThrow("canvas failed");
    });

    expect(exportJpeg).toHaveBeenNthCalledWith(
      1,
      canvas,
      manifestFixture.species[0],
      manifestFixture.species[0].forms[0],
      "question",
    );
    expect(result.current.exportMessage).toBe("导出失败，请重试");
    expect(result.current.status.type).toBe("ready");
    expect(result.current.canDownload).toBe(true);
  });
});

describe("useManifest", () => {
  it("loads a manifest and retries after a failure", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(manifestFixture as PokemonManifest);
    const { result } = renderHook(() => useManifest(loader));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.message).toBe("图鉴数据加载失败，请重试");

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.manifest).toEqual(manifestFixture);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
