import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PokemonManifest } from "../domain/pokemon";
import type { GeneratorDependencies } from "../features/generator/use-generator";
import { manifestFixture } from "../test/fixtures/pokemon-manifest";
import { App } from "./App";

const imageFixture = {
  naturalWidth: 200,
  naturalHeight: 100,
} as HTMLImageElement;
const templateImage = {
  naturalWidth: 1024,
  naturalHeight: 768,
} as HTMLImageElement;
const generatorDependencies: GeneratorDependencies = {
  rng: () => 0.5,
  loadImage: vi.fn().mockResolvedValue(imageFixture),
  createCrop: vi.fn().mockReturnValue({
    scale: 3,
    offsetX: 0,
    offsetY: 0,
    fallback: false,
  }),
  exportJpeg: vi.fn().mockResolvedValue({
    blob: new Blob(["jpeg"], { type: "image/jpeg" }),
    filename: "pokemon.jpg",
  }),
};

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      canvas: document.createElement("canvas"),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fillStyle: "",
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows manifest loading before the workbench", () => {
    render(
      <App
        loadManifest={() => new Promise(() => undefined)}
        generatorDependencies={generatorDependencies}
        templateImage={templateImage}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "宝可梦“我是谁”图片生成器" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("正在加载图鉴数据");
    expect(screen.queryByRole("button", { name: "下载题面" })).not.toBeInTheDocument();
  });

  it("retries a failed manifest load", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(manifestFixture as PokemonManifest);
    render(
      <App
        loadManifest={loader}
        generatorDependencies={generatorDependencies}
        templateImage={templateImage}
      />,
    );

    expect(
      await screen.findByText("图鉴数据加载失败，请重试"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "重试加载图鉴" }));

    expect(await screen.findByLabelText("搜索宝可梦")).toBeVisible();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("keeps downloads disabled until an image is ready and shows no-results", async () => {
    render(
      <App
        loadManifest={() => Promise.resolve(manifestFixture as PokemonManifest)}
        generatorDependencies={generatorDependencies}
        templateImage={templateImage}
      />,
    );

    const search = await screen.findByLabelText("搜索宝可梦");
    expect(screen.getByRole("button", { name: "下载题面" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下载答案" })).toBeDisabled();

    await userEvent.type(search, "missing");
    expect(screen.getByText("未找到匹配的宝可梦")).toBeVisible();
  });

  it("enables the ready workbench after selecting a species", async () => {
    render(
      <App
        loadManifest={() => Promise.resolve(manifestFixture as PokemonManifest)}
        generatorDependencies={generatorDependencies}
        templateImage={templateImage}
      />,
    );

    await userEvent.selectOptions(
      await screen.findByLabelText("宝可梦"),
      "pikachu",
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "下载题面" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "下载答案" })).toBeEnabled();
    });
    expect(screen.getByRole("status")).toHaveTextContent("图片已准备好");
  });
});
