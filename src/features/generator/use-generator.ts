import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import type {
  PokemonFormRecord,
  PokemonManifest,
  PokemonSpeciesRecord,
} from "../../domain/pokemon";
import { createRandomCrop, isCropValid } from "../rendering/crop";
import { failureMessage } from "../rendering/errors";
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
    source?: PixelBuffer,
  ) => CropTransform;
  readonly readPixels: (image: HTMLImageElement) => PixelBuffer;
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
  createCrop: (image, rng, source = readImagePixels(image)) => createRandomCrop({
    source,
    viewport: CONTENT_RECT,
  }, rng),
  readPixels: readImagePixels,
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
    readPixels: dependencyOverrides.readPixels ?? defaultDependencies.readPixels,
    exportJpeg: dependencyOverrides.exportJpeg ?? defaultDependencies.exportJpeg,
  }), [
    dependencyOverrides.createCrop,
    dependencyOverrides.exportJpeg,
    dependencyOverrides.loadImage,
    dependencyOverrides.readPixels,
    dependencyOverrides.rng,
  ]);
  const [status, dispatch] = useReducer(statusReducer, { type: "idle" });
  const [selection, setSelection] = useState<PokemonSelection | null>(null);
  const [search, setSearchValue] = useState("");
  const [mode, setModeValue] = useState<QuestionMode>("silhouette");
  const modeRef = useRef<QuestionMode>("silhouette");
  const [crop, setCrop] = useState<CropTransform | null>(null);
  const [cropValid, setCropValid] = useState(false);
  const cropSource = useRef<PixelBuffer | null>(null);
  const [zoom, setZoomValue] = useState(2);
  const [previewKind, setPreviewKindValue] = useState<PreviewKind>("question");
  const [exportMessage, setExportMessage] = useState("");
  const requestId = useRef(0);
  const unavailableFormIds = useRef(new Set<string>());

  const searchResults = useMemo(
    () => searchSpecies(manifest.species, search),
    [manifest.species, search],
  );
  const searchMessage = search.trim() !== "" && searchResults.length === 0
    ? "未找到匹配的宝可梦"
    : "";

  const generateCrop = useCallback((image: HTMLImageElement) => {
    const source = dependencies.readPixels(image);
    cropSource.current = source;
    const nextCrop = dependencies.createCrop(image, dependencies.rng, source);
    setCrop(nextCrop);
    setCropValid(isCropValid({
      source,
      viewport: CONTENT_RECT,
    }, nextCrop));
    setZoomValue(clampZoom(nextCrop.scale / containScale(image)));
  }, [dependencies]);

  const loadSelection = useCallback(async (nextSelection: PokemonSelection) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setSelection(nextSelection);
    setCrop(null);
    setCropValid(false);
    cropSource.current = null;
    setExportMessage("");
    dispatch({ type: "load", selection: nextSelection });

    let image: HTMLImageElement;
    try {
      image = await dependencies.loadImage(nextSelection.form.imageCandidates);
    } catch {
      if (requestId.current === currentRequest) {
        unavailableFormIds.current.add(nextSelection.form.id);
        dispatch({
          type: "error",
          message: "所有图片候选均加载失败，请重试或选择其他形态",
        });
      }
      return;
    }
    if (requestId.current !== currentRequest) {
      return;
    }
    try {
      if (modeRef.current === "crop") {
        generateCrop(image);
      }
      unavailableFormIds.current.delete(nextSelection.form.id);
      dispatch({ type: "ready", selection: nextSelection, image });
    } catch (error) {
      dispatch({ type: "error", message: failureMessage(error, "crop") });
    }
  }, [dependencies.loadImage, generateCrop]);

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
    try {
      const nextSelection = chooseRandomPokemon(
        manifest.species,
        dependencies.rng,
        unavailableFormIds.current,
      );
      await loadSelection(nextSelection);
    } catch (error) {
      if (error instanceof Error && error.message === "没有可用的宝可梦") {
        dispatch({ type: "error", message: "当前会话没有可用图片的宝可梦" });
        return;
      }
      throw error;
    }
  }, [dependencies.rng, loadSelection, manifest.species]);

  const retryImage = useCallback(async () => {
    if (selection !== null) {
      await loadSelection(selection);
    }
  }, [loadSelection, selection]);

  const setMode = useCallback((nextMode: QuestionMode) => {
    modeRef.current = nextMode;
    setModeValue(nextMode);
    if (nextMode === "crop" && status.type === "ready") {
      try {
        generateCrop(status.image);
      } catch (error) {
        dispatch({ type: "error", message: failureMessage(error, "crop") });
      }
    }
  }, [generateCrop, status]);

  const randomizeCrop = useCallback(() => {
    if (status.type === "ready") {
      try {
        generateCrop(status.image);
      } catch (error) {
        dispatch({ type: "error", message: failureMessage(error, "crop") });
      }
    }
  }, [generateCrop, status]);

  const dragCrop = useCallback((deltaX: number, deltaY: number) => {
    setCrop((current) => {
      const source = cropSource.current;
      if (current === null || source === null) {
        setCropValid(false);
        return current;
      }
      const candidate = {
        ...current,
        offsetX: current.offsetX + deltaX,
        offsetY: current.offsetY + deltaY,
        fallback: false,
      };
      if (!isCropValid({ source, viewport: CONTENT_RECT }, candidate)) {
        return current;
      }
      setCropValid(true);
      return candidate;
    });
  }, []);

  const setZoom = useCallback((multiplier: number) => {
    if (status.type !== "ready") {
      return;
    }
    const nextZoom = clampZoom(multiplier);
    const nextScale = containScale(status.image) * nextZoom;
    setCrop((current) => {
      const source = cropSource.current;
      if (current === null || source === null) {
        setCropValid(false);
        return current;
      }
      const centerX = CONTENT_RECT.x + CONTENT_RECT.width / 2;
      const centerY = CONTENT_RECT.y + CONTENT_RECT.height / 2;
      const sourceCenterX = (centerX - current.offsetX) / current.scale;
      const sourceCenterY = (centerY - current.offsetY) / current.scale;
      const candidate = {
        scale: nextScale,
        offsetX: centerX - sourceCenterX * nextScale,
        offsetY: centerY - sourceCenterY * nextScale,
        fallback: false,
      };
      if (!isCropValid({ source, viewport: CONTENT_RECT }, candidate)) {
        return current;
      }
      setZoomValue(nextZoom);
      setCropValid(true);
      return candidate;
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
      setExportMessage(failureMessage(error, "export"));
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
    canDownload: status.type === "ready"
      && (mode !== "crop" || (crop !== null && cropValid)),
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
