import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PokemonManifest } from "../../domain/pokemon";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import type { CropTransform, PixelBuffer } from "../rendering/types";
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
    readPixels: vi.fn().mockReturnValue(solidPixels(200, 100)),
    exportJpeg: vi.fn().mockResolvedValue({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      filename: "pokemon.jpg",
    }),
    ...overrides,
  };
}

function solidPixels(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = 255;
  }
  return { width, height, data };
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
    expect(result.current.zoom).toBe(6);
    expect(result.current.crop?.scale).toBeCloseTo(9.6);

    act(() => result.current.setZoom(0));
    expect(result.current.zoom).toBe(1.5);
    expect(result.current.crop?.scale).toBeCloseTo(2.4);

    act(() => result.current.setMode("silhouette"));
    expect(result.current.mode).toBe("silhouette");
  });

  it("rejects extreme drag and zoom transforms for a transparent shape", async () => {
    const transparentShape = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(4 * 4 * 4),
    };
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
      transparentShape.data[(y * 4 + x) * 4 + 3] = 255;
    }
    const image = { naturalWidth: 4, naturalHeight: 4 } as HTMLImageElement;
    const validCrop: CropTransform = {
      scale: 160,
      offsetX: -218,
      offsetY: -55,
      fallback: false,
    };
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({
        loadImage: vi.fn().mockResolvedValue(image),
        readPixels: vi.fn().mockReturnValue(transparentShape),
        createCrop: vi.fn().mockReturnValue(validCrop),
      }),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    act(() => result.current.setMode("crop"));
    expect(result.current.canDownload).toBe(true);

    act(() => result.current.dragCrop(10_000, 10_000));
    expect(result.current.crop).toEqual(validCrop);
    expect(result.current.canDownload).toBe(true);

    transparentShape.data.fill(0);
    act(() => result.current.dragCrop(8, 0));
    expect(result.current.crop).toEqual({
      ...validCrop,
      offsetX: validCrop.offsetX + 8,
    });

    act(() => result.current.setZoom(1.5));
    expect(result.current.crop).toEqual({
      ...validCrop,
      offsetX: validCrop.offsetX + 8,
    });
    expect(result.current.zoom).toBe(2);
    expect(result.current.canDownload).toBe(true);
  });

  it("uses the latest crop mode when a deferred image resolves", async () => {
    const imageLoad = deferred<HTMLImageElement>();
    const createCrop = vi.fn().mockReturnValue(initialCrop);
    const dependencies = createDependencies({
      loadImage: vi.fn().mockReturnValue(imageLoad.promise),
      createCrop,
    });
    const snapshots: Array<{
      status: string;
      mode: string;
      hasCrop: boolean;
      canDownload: boolean;
    }> = [];
    const { result } = renderHook(() => {
      const controller = useGenerator(
        manifestFixture as PokemonManifest,
        dependencies,
      );
      snapshots.push({
        status: controller.status.type,
        mode: controller.mode,
        hasCrop: controller.crop !== null,
        canDownload: controller.canDownload,
      });
      return controller;
    });

    let selectionPromise!: Promise<void>;
    act(() => {
      selectionPromise = result.current.selectSpecies(
        manifestFixture.species[0],
      );
    });
    act(() => result.current.setMode("crop"));
    expect(result.current.canDownload).toBe(false);

    await act(async () => {
      imageLoad.resolve(imageFixture);
      await selectionPromise;
    });

    expect(createCrop).toHaveBeenCalledWith(
      imageFixture,
      expect.any(Function),
      expect.objectContaining({ width: 200, height: 100 }),
      expect.objectContaining({
        bounds: expect.objectContaining({ opaquePixels: 20_000 }),
        integral: expect.any(Uint32Array),
      }),
    );
    expect(result.current.mode).toBe("crop");
    expect(result.current.crop).toEqual(initialCrop);
    expect(result.current.status.type).toBe("ready");
    expect(result.current.canDownload).toBe(true);
    expect(snapshots).not.toContainEqual({
      status: "ready",
      mode: "crop",
      hasCrop: false,
      canDownload: true,
    });
  });

  it("does not create a crop when mode returns to silhouette during loading", async () => {
    const imageLoad = deferred<HTMLImageElement>();
    const createCrop = vi.fn().mockReturnValue(initialCrop);
    const dependencies = createDependencies({
      loadImage: vi.fn().mockReturnValue(imageLoad.promise),
      createCrop,
    });
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      dependencies,
    ));

    let selectionPromise!: Promise<void>;
    act(() => {
      selectionPromise = result.current.selectSpecies(
        manifestFixture.species[0],
      );
    });
    act(() => result.current.setMode("crop"));
    act(() => result.current.setMode("silhouette"));
    await act(async () => {
      imageLoad.resolve(imageFixture);
      await selectionPromise;
    });

    expect(createCrop).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("silhouette");
    expect(result.current.crop).toBeNull();
    expect(result.current.status.type).toBe("ready");
    expect(result.current.canDownload).toBe(true);
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
      message: "所有图片候选均加载失败，请重试或选择其他形态",
    });
    expect(result.current.selection?.species.slug).toBe("bulbasaur");
    expect(result.current.canDownload).toBe(false);

    await act(async () => {
      await result.current.retryImage();
    });
    expect(result.current.status.type).toBe("ready");
    expect(loadImage).toHaveBeenCalledTimes(2);
  });

  it("excludes failed forms and species from later random choices", async () => {
    const loadImage = vi.fn()
      .mockRejectedValueOnce(new Error("all candidates failed"))
      .mockResolvedValue(imageFixture);
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({
        loadImage,
        rng: sequenceRng([0, 0]),
      }),
    ));

    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    await act(async () => {
      await result.current.randomize();
    });

    expect(result.current.selection?.species.slug).toBe("pikachu");
    expect(result.current.selection?.form.slug).toBe("pikachu");
  });

  it("restores a failed form to randomization after a successful explicit retry", async () => {
    const loadImage = vi.fn()
      .mockRejectedValueOnce(new Error("all candidates failed"))
      .mockResolvedValue(imageFixture);
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({
        loadImage,
        rng: sequenceRng([0, 0]),
      }),
    ));

    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });
    await act(async () => {
      await result.current.retryImage();
    });
    await act(async () => {
      await result.current.randomize();
    });

    expect(result.current.selection?.species.slug).toBe("bulbasaur");
    expect(loadImage).toHaveBeenCalledTimes(3);
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
      .mockRejectedValueOnce(new Error("JPG 导出失败"));
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
      await expect(result.current.exportAnswer(canvas)).rejects.toThrow("JPG 导出失败");
    });

    expect(exportJpeg).toHaveBeenNthCalledWith(
      1,
      canvas,
      manifestFixture.species[0],
      manifestFixture.species[0].forms[0],
      "question",
    );
    expect(result.current.exportMessage).toBe("JPEG 编码失败，请重试或更换浏览器");
    expect(result.current.status.type).toBe("ready");
    expect(result.current.canDownload).toBe(true);
  });

  it.each([
    [
      Object.assign(new Error("tainted"), { name: "SecurityError" }),
      "图片受跨域限制，无法读取像素或导出，请选择其他图片",
    ],
    [
      new Error("浏览器不支持图片像素读取"),
      "当前浏览器不支持 Canvas 像素处理",
    ],
  ])("classifies crop pixel failures for the UI", async (error, message) => {
    const { result } = renderHook(() => useGenerator(
      manifestFixture as PokemonManifest,
      createDependencies({
        readPixels: vi.fn(() => {
          throw error;
        }),
      }),
    ));
    await act(async () => {
      await result.current.selectSpecies(manifestFixture.species[0]);
    });

    act(() => result.current.setMode("crop"));

    expect(result.current.status).toEqual({ type: "error", message });
    expect(result.current.canDownload).toBe(false);
  });
});

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
