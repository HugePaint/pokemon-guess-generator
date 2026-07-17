import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PokemonManifest } from "../domain/pokemon";
import {
  useGenerator,
  type GeneratorController,
  type GeneratorDependencies,
} from "../features/generator/use-generator";
import type { PreviewKind } from "../features/generator/use-generator";
import { manifestFixture } from "../test/fixtures/pokemon-manifest";
import { ControlPanel } from "./ControlPanel";
import { LegalNotice } from "./LegalNotice";
import { PreviewPanel } from "./PreviewPanel";

const sourceImage = {
  naturalWidth: 200,
  naturalHeight: 100,
} as HTMLImageElement;
const templateImage = {
  naturalWidth: 1024,
  naturalHeight: 768,
} as HTMLImageElement;

const dependencies: GeneratorDependencies = {
  rng: () => 0.5,
  loadImage: vi.fn().mockResolvedValue(sourceImage),
  createCrop: vi.fn().mockReturnValue({
    scale: 3,
    offsetX: 10,
    offsetY: 20,
    fallback: false,
  }),
  exportJpeg: vi.fn().mockResolvedValue({
    blob: new Blob(["jpeg"], { type: "image/jpeg" }),
    filename: "pokemon.jpg",
  }),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ControlHarness() {
  const controller = useGenerator(
    manifestFixture as PokemonManifest,
    dependencies,
  );
  useEffect(() => {
    void controller.selectSpecies(manifestFixture.species[1]);
    // The harness initializes one known multi-form selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <ControlPanel controller={controller} />;
}

function controllerFixture(
  overrides: Partial<GeneratorController> = {},
): GeneratorController {
  const selection = {
    species: manifestFixture.species[1],
    form: manifestFixture.species[1].forms[0],
  };
  return {
    manifest: manifestFixture as PokemonManifest,
    search: "",
    searchResults: manifestFixture.species,
    searchMessage: "",
    selection,
    mode: "crop",
    crop: { scale: 3, offsetX: 10, offsetY: 20, fallback: false },
    zoom: 2,
    previewKind: "question",
    status: { type: "ready", selection, image: sourceImage },
    canDownload: true,
    exportMessage: "",
    setSearch: vi.fn(),
    selectSpecies: vi.fn().mockResolvedValue(undefined),
    selectForm: vi.fn().mockResolvedValue(undefined),
    randomize: vi.fn().mockResolvedValue(undefined),
    retryImage: vi.fn().mockResolvedValue(undefined),
    setMode: vi.fn(),
    randomizeCrop: vi.fn(),
    dragCrop: vi.fn(),
    setZoom: vi.fn(),
    setPreviewKind: vi.fn(),
    exportQuestion: vi.fn().mockResolvedValue({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      filename: "question.jpg",
    }),
    exportAnswer: vi.fn().mockResolvedValue({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      filename: "answer.jpg",
    }),
    ...overrides,
  };
}

describe("ControlPanel", () => {
  it("shows form selection and crop controls only when applicable", async () => {
    render(<ControlHarness />);

    expect(await screen.findByLabelText("形态")).toBeVisible();
    expect(screen.queryByLabelText("缩放")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "区域裁剪" }));

    expect(screen.getByLabelText("缩放")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "重新随机裁剪" }),
    ).toBeVisible();
  });

  it("offers search results without replacing the current selection on no results", async () => {
    render(<ControlHarness />);
    const search = screen.getByLabelText("搜索宝可梦");

    await userEvent.clear(search);
    await userEvent.type(search, "missing");
    expect(screen.getByText("未找到匹配的宝可梦")).toBeVisible();
    expect(screen.getByLabelText("宝可梦")).toHaveValue("pikachu");

    await userEvent.clear(search);
    await userEvent.type(search, "妙蛙");
    expect(
      within(screen.getByRole("listbox", { name: "搜索结果" }))
        .getByRole("option", { name: /妙蛙种子/ }),
    ).toBeVisible();
  });
});

describe("PreviewPanel", () => {
  it("renders tabs, scales pointer movement and keeps separate downloads", async () => {
    const dragCrop = vi.fn();
    const setPreviewKind = vi.fn();
    const controller = controllerFixture({ dragCrop, setPreviewKind });
    const getContext = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext",
    ).mockReturnValue(createCanvasContext());
    const rect = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      width: 512,
      height: 384,
      x: 0,
      y: 0,
      top: 0,
      right: 512,
      bottom: 384,
      left: 0,
      toJSON: () => ({}),
    });

    render(
      <PreviewPanel controller={controller} templateImage={templateImage} />,
    );
    const canvas = screen.getByRole("img", { name: "生成图片预览" });
    fireEvent.pointerDown(canvas, { pointerId: 1 });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      movementX: 10,
      movementY: -5,
    });

    expect(dragCrop).toHaveBeenCalledWith(20, -10);
    await userEvent.click(screen.getByRole("tab", { name: "答案预览" }));
    expect(setPreviewKind).toHaveBeenCalledWith("answer" satisfies PreviewKind);
    expect(screen.getByRole("button", { name: "下载题面" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下载答案" })).toBeEnabled();

    getContext.mockRestore();
    rect.mockRestore();
  });

  it("announces image failures and supports retry", async () => {
    const retryImage = vi.fn().mockResolvedValue(undefined);
    render(
      <PreviewPanel
        controller={controllerFixture({
          status: { type: "error", message: "图片加载失败，请重试" },
          canDownload: false,
          retryImage,
        })}
        templateImage={templateImage}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("图片加载失败，请重试");
    await userEvent.click(screen.getByRole("button", { name: "重试图片" }));
    expect(retryImage).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "下载题面" })).toBeDisabled();
  });
});

describe("LegalNotice", () => {
  it("states ownership, sources and lack of authorization", () => {
    render(<LegalNotice />);

    expect(screen.getByText(/非官方/)).toHaveTextContent("非商业");
    expect(screen.getByText(/非官方/)).toHaveTextContent("The Pokémon Company");
    expect(screen.getByText(/非官方/)).toHaveTextContent("未获得其授权或认可");
    expect(screen.getByRole("link", { name: "PokéAPI" })).toHaveAttribute(
      "href",
      "https://pokeapi.co/",
    );
    expect(screen.getByRole("link", { name: "PokeAPI sprites" })).toBeVisible();
  });
});

function createCanvasContext(): CanvasRenderingContext2D {
  return {
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
  } as unknown as CanvasRenderingContext2D;
}
