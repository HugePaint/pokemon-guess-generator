import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../domain/pokemon";
import type { CropTransform, Rect } from "./types";
import {
  ANSWER_PANEL_FILL,
  ANSWER_RECT,
  ANSWER_TEXT_FILL,
  CANVAS_SIZE,
  CONTENT_RECT,
} from "./template";

export type QuestionMode = "silhouette" | "crop";

export interface RenderState {
  readonly species: Pick<PokemonSpeciesRecord, "id" | "slug" | "names">;
  readonly form: Pick<
    PokemonFormRecord,
    "id" | "slug" | "names" | "isDefault" | "gender"
  >;
  readonly templateImage: HTMLImageElement;
  readonly sourceImage: HTMLImageElement;
  readonly mode: QuestionMode;
  readonly cropTransform?: CropTransform;
}

export interface ArtInstruction {
  readonly source: CanvasImageSource;
  readonly destination: Readonly<Rect>;
  readonly silhouette: boolean;
}

export interface AnswerPanel {
  readonly rect: Readonly<Rect>;
  readonly fill: string;
}

export interface AnswerLine {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly fill: string;
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
}

export interface RenderPlan {
  readonly canvasSize: Readonly<{ width: number; height: number }>;
  readonly templateImage: CanvasImageSource;
  readonly clipRect: Readonly<Rect>;
  readonly art: Readonly<ArtInstruction>;
  readonly answerPanel?: Readonly<AnswerPanel>;
  readonly answerLines: readonly Readonly<AnswerLine>[];
}

export function buildQuestionPlan(state: RenderState): RenderPlan {
  const art = state.mode === "silhouette"
    ? createContainArt(state.sourceImage, true)
    : createCropArt(state.sourceImage, state.cropTransform);

  return freezePlan({
    canvasSize: CANVAS_SIZE,
    templateImage: state.templateImage,
    clipRect: CONTENT_RECT,
    art,
    answerLines: [],
  });
}

export function buildAnswerPlan(state: RenderState): RenderPlan {
  const formName = getAnswerFormName(state.form);
  const texts = [
    state.species.names.zhHans,
    state.species.names.en,
    `No.${String(state.species.id).padStart(4, "0")}`,
    formName,
  ];

  return freezePlan({
    canvasSize: CANVAS_SIZE,
    templateImage: state.templateImage,
    clipRect: CONTENT_RECT,
    art: createContainArt(state.sourceImage, false),
    answerPanel: {
      rect: ANSWER_RECT,
      fill: ANSWER_PANEL_FILL,
    },
    answerLines: texts.map((text, index) => ({
      text,
      x: ANSWER_RECT.x + ANSWER_RECT.width / 2,
      y: ANSWER_RECT.y + 35 + index * 54,
      font: index < 2 ? "700 36px sans-serif" : "700 30px sans-serif",
      fill: ANSWER_TEXT_FILL,
      align: "center",
      baseline: "middle",
    })),
  });
}

function getAnswerFormName(state: RenderState["form"]): string {
  if (state.isDefault) {
    return "默认形态";
  }

  const name = state.names.zhHans ?? state.names.en;
  return state.gender === "female" ? `${name}（雌性）` : name;
}

function createContainArt(
  source: HTMLImageElement,
  silhouette: boolean,
): ArtInstruction {
  const { width, height } = imageDimensions(source);
  const scale = Math.min(CONTENT_RECT.width / width, CONTENT_RECT.height / height);
  const destinationWidth = width * scale;
  const destinationHeight = height * scale;

  return {
    source,
    destination: {
      x: CONTENT_RECT.x + (CONTENT_RECT.width - destinationWidth) / 2,
      y: CONTENT_RECT.y + (CONTENT_RECT.height - destinationHeight) / 2,
      width: destinationWidth,
      height: destinationHeight,
    },
    silhouette,
  };
}

function createCropArt(
  source: HTMLImageElement,
  transform: CropTransform | undefined,
): ArtInstruction {
  if (transform === undefined) {
    throw new Error("区域裁剪缺少变换参数");
  }

  const { width, height } = imageDimensions(source);
  return {
    source,
    destination: {
      x: transform.offsetX,
      y: transform.offsetY,
      width: width * transform.scale,
      height: height * transform.scale,
    },
    silhouette: false,
  };
}

function imageDimensions(image: HTMLImageElement): { width: number; height: number } {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (width <= 0 || height <= 0) {
    throw new Error("图片尺寸无效");
  }

  return { width, height };
}

function freezePlan(plan: RenderPlan): RenderPlan {
  const canvasSize = Object.freeze({ ...plan.canvasSize });
  const clipRect = Object.freeze({ ...plan.clipRect });
  const art = Object.freeze({
    ...plan.art,
    destination: Object.freeze({ ...plan.art.destination }),
  });
  const answerPanel = plan.answerPanel === undefined
    ? undefined
    : Object.freeze({
      ...plan.answerPanel,
      rect: Object.freeze({ ...plan.answerPanel.rect }),
    });
  const answerLines = Object.freeze(
    plan.answerLines.map((line) => Object.freeze({ ...line })),
  );

  return Object.freeze({
    canvasSize,
    templateImage: plan.templateImage,
    clipRect,
    art,
    ...(answerPanel === undefined ? {} : { answerPanel }),
    answerLines,
  });
}
