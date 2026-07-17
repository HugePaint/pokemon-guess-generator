import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
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
  readPixels: vi.fn().mockReturnValue({
    width: 200,
    height: 100,
    data: new Uint8ClampedArray(200 * 100 * 4).fill(255),
  }),
  exportJpeg: vi.fn().mockResolvedValue({
    blob: new Blob(["jpeg"], { type: "image/jpeg" }),
    filename: "pokemon.jpg",
  }),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

function PreviewTabsHarness() {
  const [previewKind, setPreviewKind] = useState<PreviewKind>("question");
  return (
    <PreviewPanel
      controller={controllerFixture({ previewKind, setPreviewKind })}
      templateImage={templateImage}
    />
  );
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

  it("implements complete combobox keyboard selection semantics", async () => {
    render(<ControlHarness />);
    const search = screen.getByRole("combobox", { name: "搜索宝可梦" });

    await userEvent.clear(search);
    await userEvent.type(search, "皮");
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveAttribute("aria-controls", "pokemon-search-results");

    await userEvent.keyboard("{ArrowDown}");
    const pikachuOption = within(
      screen.getByRole("listbox", { name: "搜索结果" }),
    ).getByRole("option", { name: /皮卡丘/ });
    expect(search).toHaveAttribute("aria-activedescendant", pikachuOption.id);
    expect(search).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByLabelText("宝可梦")).toHaveValue("pikachu");
    });
    expect(search).toHaveAttribute("aria-expanded", "false");

    await userEvent.clear(search);
    await userEvent.type(search, "皮");
    expect(search).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(search).toHaveFocus();
  });
});

describe("PreviewPanel", () => {
  it("implements roving keyboard tabs with associated tabpanels", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(createCanvasContext());
    render(<PreviewTabsHarness />);
    const questionTab = screen.getByRole("tab", { name: "题面预览" });
    const answerTab = screen.getByRole("tab", { name: "答案预览" });

    expect(questionTab).toHaveAttribute("id", "question-preview-tab");
    expect(questionTab).toHaveAttribute(
      "aria-controls",
      "question-preview-panel",
    );
    expect(questionTab).toHaveAttribute("tabindex", "0");
    expect(answerTab).toHaveAttribute("tabindex", "-1");
    expect(document.getElementById("question-preview-panel")).toHaveAttribute(
      "aria-labelledby",
      "question-preview-tab",
    );
    expect(document.getElementById("answer-preview-panel")).toHaveAttribute(
      "hidden",
    );

    questionTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(answerTab).toHaveFocus();
    expect(answerTab).toHaveAttribute("aria-selected", "true");
    expect(answerTab).toHaveAttribute("tabindex", "0");
    expect(questionTab).toHaveAttribute("tabindex", "-1");
    expect(document.getElementById("answer-preview-panel")).not.toHaveAttribute(
      "hidden",
    );

    await userEvent.keyboard("{ArrowLeft}");
    expect(questionTab).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(answerTab).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(questionTab).toHaveFocus();
  });

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

  it("makes crop adjustment focusable and supports documented arrow steps", async () => {
    const dragCrop = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(createCanvasContext());
    render(
      <PreviewPanel
        controller={controllerFixture({ dragCrop })}
        templateImage={templateImage}
      />,
    );
    const canvas = screen.getByRole("img", { name: "生成图片预览" });

    expect(canvas).toHaveAttribute("tabindex", "0");
    expect(canvas).toHaveAccessibleDescription(
      "使用方向键每次移动 8 像素，按住 Shift 每次移动 32 像素。",
    );
    canvas.focus();
    await userEvent.keyboard("{ArrowRight}{Shift>}{ArrowUp}{/Shift}");

    expect(dragCrop).toHaveBeenNthCalledWith(1, 8, 0);
    expect(dragCrop).toHaveBeenNthCalledWith(2, 0, -32);
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

  it("exports offscreen without restoring stale selection or tab state", async () => {
    const exportResult = deferred<{
      blob: Blob;
      filename: string;
    }>();
    const exportAnswer = vi.fn().mockReturnValue(exportResult.promise);
    const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        let context = contexts.get(this);
        if (context === undefined) {
          context = createCanvasContext(this);
          contexts.set(this, context);
        }
        return context;
      },
    );
    const createObjectURL = vi.fn().mockReturnValue("blob:task-7-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const firstController = controllerFixture({
      previewKind: "question",
      exportAnswer,
    });
    const { rerender } = render(
      <PreviewPanel
        controller={firstController}
        templateImage={templateImage}
      />,
    );
    const visibleCanvas = screen.getByRole("img", {
      name: "生成图片预览",
    }) as HTMLCanvasElement;

    await userEvent.click(screen.getByRole("button", { name: "下载答案" }));
    await waitFor(() => expect(exportAnswer).toHaveBeenCalledOnce());
    const exportCanvas = exportAnswer.mock.calls[0]?.[0] as HTMLCanvasElement;
    expect(exportCanvas).not.toBe(visibleCanvas);
    expect(
      vi.mocked(contexts.get(exportCanvas)!.drawImage).mock.calls.at(-1)?.[0],
    ).toBe(sourceImage);

    const nextImage = {
      naturalWidth: 300,
      naturalHeight: 300,
    } as HTMLImageElement;
    const nextSelection = {
      species: manifestFixture.species[0],
      form: manifestFixture.species[0].forms[0],
    };
    rerender(
      <PreviewPanel
        controller={controllerFixture({
          selection: nextSelection,
          previewKind: "answer",
          status: {
            type: "ready",
            selection: nextSelection,
            image: nextImage,
          },
        })}
        templateImage={templateImage}
      />,
    );
    const currentVisibleCanvas = screen.getByRole("img", {
      name: "生成图片预览",
    }) as HTMLCanvasElement;

    const blob = new Blob(["answer"], { type: "image/jpeg" });
    let revokeTask: (() => void) | undefined;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: TimerHandler) => {
      revokeTask = handler as () => void;
      return 1;
    }) as typeof setTimeout);
    await act(async () => {
      exportResult.resolve({ blob, filename: "answer.jpg" });
      await exportResult.promise;
    });

    const visibleContext = contexts.get(currentVisibleCanvas);
    expect(visibleContext).toBeDefined();
    expect(vi.mocked(visibleContext!.drawImage).mock.calls.at(-1)?.[0])
      .toBe(nextImage);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchorClick).toHaveBeenCalledOnce();
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("answer.jpg");
    expect(anchor.href).toBe("blob:task-7-export");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    revokeTask?.();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:task-7-export");
  });

  it("surfaces unsupported Canvas and download trigger failures", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { rerender } = render(
      <PreviewPanel
        controller={controllerFixture()}
        templateImage={templateImage}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前浏览器不支持 Canvas 像素处理",
    );

    vi.mocked(HTMLCanvasElement.prototype.getContext)
      .mockReturnValue(createCanvasContext());
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:download"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    rerender(
      <PreviewPanel
        controller={controllerFixture()}
        templateImage={templateImage}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "下载题面" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "浏览器无法启动下载，请检查下载权限后重试",
    );
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

function createCanvasContext(
  canvas = document.createElement("canvas"),
): CanvasRenderingContext2D {
  return {
    canvas,
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

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
