import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import type {
  PokemonFormRecord,
  PokemonManifest,
  PokemonSpeciesRecord,
} from "../../domain/pokemon";
import { createRandomCrop } from "../rendering/crop";
import {
  exportJpeg as exportCanvasJpeg,
  type ExportedJpeg,
  type ExportKind,
} from "../rendering/export-jpeg";
import { loadFirstImage } from "../rendering/load-image";
import type { QuestionMode } from "../rendering/render-plan";
import { CONTENT_RECT } from "../rendering/template";
import type { CropTransform, PixelBuffer } from "../rendering/types";
import { chooseRandomPokemon, type PokemonSelection } from "../selection/random";
import { searchSpecies } from "../selection/search";

export type PreviewKind = "question" | "answer";

export type GeneratorStatus =
  | { type: "idle" }
  | { type: "loading-image"; selection: PokemonSelection }
  | { type: "ready"; selection: PokemonSelection; image: HTMLImageElement }
  | { type: "error"; message: string };

type StatusAction =
  | { type: "load"; selection: PokemonSelection }
  | { type: "ready"; selection: PokemonSelection; image: HTMLImageElement }
  | { type: "error"; message: string };

export interface GeneratorDependencies {
  readonly rng: () => number;
  readonly loadImage: (candidates: readonly string[]) => Promise<HTMLImageElement>;
  readonly createCrop: (
    image: HTMLImageElement,
    rng: () => number,
  ) => CropTransform;
  readonly exportJpeg: (
    canvas: HTMLCanvasElement,
    species: PokemonSpeciesRecord,
    form: PokemonFormRecord,
    kind: ExportKind,
  ) => Promise<ExportedJpeg>;
}

export interface GeneratorController {
  readonly manifest: PokemonManifest;
  readonly search: string;
  readonly searchResults: PokemonSpeciesRecord[];
  readonly searchMessage: string;
  readonly selection: PokemonSelection | null;
  readonly mode: QuestionMode;
  readonly crop: CropTransform | null;
  readonly zoom: number;
  readonly previewKind: PreviewKind;
  readonly status: GeneratorStatus;
  readonly canDownload: boolean;
  readonly exportMessage: string;
  setSearch(value: string): void;
  selectSpecies(species: PokemonSpeciesRecord): Promise<void>;
  selectForm(form: PokemonFormRecord): Promise<void>;
  randomize(): Promise<void>;
  retryImage(): Promise<void>;
  setMode(mode: QuestionMode): void;
  randomizeCrop(): void;
  dragCrop(deltaX: number, deltaY: number): void;
  setZoom(multiplier: number): void;
  setPreviewKind(kind: PreviewKind): void;
  exportQuestion(canvas: HTMLCanvasElement): Promise<ExportedJpeg>;
  exportAnswer(canvas: HTMLCanvasElement): Promise<ExportedJpeg>;
}

const defaultDependencies: GeneratorDependencies = {
  rng: Math.random,
  loadImage: loadFirstImage,
  createCrop: (image, rng) => createRandomCrop({
    source: readImagePixels(image),
    viewport: CONTENT_RECT,
  }, rng),
  exportJpeg: exportCanvasJpeg,
};

function statusReducer(
  _state: GeneratorStatus,
  action: StatusAction,
): GeneratorStatus {
  if (action.type === "load") {
    return { type: "loading-image", selection: action.selection };
  }
  if (action.type === "ready") {
    return {
      type: "ready",
      selection: action.selection,
      image: action.image,
    };
  }
  return { type: "error", message: action.message };
}

export function useGenerator(
  manifest: PokemonManifest,
  dependencyOverrides: Partial<GeneratorDependencies> = {},
): GeneratorController {
  const dependencies = useMemo<GeneratorDependencies>(() => ({
    rng: dependencyOverrides.rng ?? defaultDependencies.rng,
    loadImage: dependencyOverrides.loadImage ?? defaultDependencies.loadImage,
    createCrop: dependencyOverrides.createCrop ?? defaultDependencies.createCrop,
    exportJpeg: dependencyOverrides.exportJpeg ?? defaultDependencies.exportJpeg,
  }), [
    dependencyOverrides.createCrop,
    dependencyOverrides.exportJpeg,
    dependencyOverrides.loadImage,
    dependencyOverrides.rng,
  ]);
  const [status, dispatch] = useReducer(statusReducer, { type: "idle" });
  const [selection, setSelection] = useState<PokemonSelection | null>(null);
  const [search, setSearchValue] = useState("");
  const [mode, setModeValue] = useState<QuestionMode>("silhouette");
  const [crop, setCrop] = useState<CropTransform | null>(null);
  const [zoom, setZoomValue] = useState(2);
  const [previewKind, setPreviewKindValue] = useState<PreviewKind>("question");
  const [exportMessage, setExportMessage] = useState("");
  const requestId = useRef(0);

  const searchResults = useMemo(
    () => searchSpecies(manifest.species, search),
    [manifest.species, search],
  );
  const searchMessage = search.trim() !== "" && searchResults.length === 0
    ? "未找到匹配的宝可梦"
    : "";

  const generateCrop = useCallback((image: HTMLImageElement) => {
    const nextCrop = dependencies.createCrop(image, dependencies.rng);
    setCrop(nextCrop);
    setZoomValue(clampZoom(nextCrop.scale / containScale(image)));
  }, [dependencies]);

  const loadSelection = useCallback(async (nextSelection: PokemonSelection) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setSelection(nextSelection);
    setCrop(null);
    setExportMessage("");
    dispatch({ type: "load", selection: nextSelection });

    try {
      const image = await dependencies.loadImage(nextSelection.form.imageCandidates);
      if (requestId.current !== currentRequest) {
        return;
      }
      dispatch({ type: "ready", selection: nextSelection, image });
      if (mode === "crop") {
        generateCrop(image);
      }
    } catch {
      if (requestId.current === currentRequest) {
        dispatch({ type: "error", message: "图片加载失败，请重试" });
      }
    }
  }, [dependencies, generateCrop, mode]);

  const selectSpecies = useCallback(async (species: PokemonSpeciesRecord) => {
    const form = species.forms.find((candidate) => candidate.isDefault)
      ?? species.forms[0];
    if (form !== undefined) {
      await loadSelection({ species, form });
    }
  }, [loadSelection]);

  const selectForm = useCallback(async (form: PokemonFormRecord) => {
    if (selection === null) {
      return;
    }
    const ownedForm = selection.species.forms.find(
      (candidate) => candidate.id === form.id,
    );
    if (ownedForm !== undefined) {
      await loadSelection({ species: selection.species, form: ownedForm });
    }
  }, [loadSelection, selection]);

  const randomize = useCallback(async () => {
    await loadSelection(chooseRandomPokemon(manifest.species, dependencies.rng));
  }, [dependencies.rng, loadSelection, manifest.species]);

  const retryImage = useCallback(async () => {
    if (selection !== null) {
      await loadSelection(selection);
    }
  }, [loadSelection, selection]);

  const setMode = useCallback((nextMode: QuestionMode) => {
    setModeValue(nextMode);
    if (nextMode === "crop" && status.type === "ready") {
      try {
        generateCrop(status.image);
      } catch {
        dispatch({ type: "error", message: "无法生成裁剪，请重试" });
      }
    }
  }, [generateCrop, status]);

  const randomizeCrop = useCallback(() => {
    if (status.type === "ready") {
      try {
        generateCrop(status.image);
      } catch {
        dispatch({ type: "error", message: "无法生成裁剪，请重试" });
      }
    }
  }, [generateCrop, status]);

  const dragCrop = useCallback((deltaX: number, deltaY: number) => {
    setCrop((current) => current === null ? current : {
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY,
      fallback: false,
    });
  }, []);

  const setZoom = useCallback((multiplier: number) => {
    if (status.type !== "ready") {
      return;
    }
    const nextZoom = clampZoom(multiplier);
    const nextScale = containScale(status.image) * nextZoom;
    setZoomValue(nextZoom);
    setCrop((current) => {
      if (current === null) {
        return current;
      }
      const centerX = CONTENT_RECT.x + CONTENT_RECT.width / 2;
      const centerY = CONTENT_RECT.y + CONTENT_RECT.height / 2;
      const sourceCenterX = (centerX - current.offsetX) / current.scale;
      const sourceCenterY = (centerY - current.offsetY) / current.scale;
      return {
        scale: nextScale,
        offsetX: centerX - sourceCenterX * nextScale,
        offsetY: centerY - sourceCenterY * nextScale,
        fallback: false,
      };
    });
  }, [status]);

  const exportKind = useCallback(async (
    canvas: HTMLCanvasElement,
    kind: ExportKind,
  ): Promise<ExportedJpeg> => {
    if (status.type !== "ready") {
      throw new Error("图片尚未准备好");
    }
    setExportMessage("");
    try {
      return await dependencies.exportJpeg(
        canvas,
        status.selection.species,
        status.selection.form,
        kind,
      );
    } catch (error) {
      setExportMessage("导出失败，请重试");
      throw error;
    }
  }, [dependencies, status]);

  return {
    manifest,
    search,
    searchResults,
    searchMessage,
    selection,
    mode,
    crop,
    zoom,
    previewKind,
    status,
    canDownload: status.type === "ready",
    exportMessage,
    setSearch: setSearchValue,
    selectSpecies,
    selectForm,
    randomize,
    retryImage,
    setMode,
    randomizeCrop,
    dragCrop,
    setZoom,
    setPreviewKind: setPreviewKindValue,
    exportQuestion: (canvas) => exportKind(canvas, "question"),
    exportAnswer: (canvas) => exportKind(canvas, "answer"),
  };
}

function containScale(image: HTMLImageElement): number {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return Math.min(CONTENT_RECT.width / width, CONTENT_RECT.height / height);
}

function clampZoom(value: number): number {
  return Math.max(1.5, Math.min(3, value));
}

function readImagePixels(image: HTMLImageElement): PixelBuffer {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("浏览器不支持图片像素读取");
  }
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}
