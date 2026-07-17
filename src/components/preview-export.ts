import type {
  GeneratorController,
  PreviewKind,
} from "../features/generator/use-generator";
import { renderPlan } from "../features/rendering/canvas-renderer";
import {
  buildAnswerPlan,
  buildQuestionPlan,
  type RenderState,
} from "../features/rendering/render-plan";
import { CANVAS_SIZE } from "../features/rendering/template";

type PreviewSnapshot = Pick<
  GeneratorController,
  "status" | "mode" | "crop" | "exportQuestion" | "exportAnswer"
>;

export function renderPreviewCanvas(
  canvas: HTMLCanvasElement,
  controller: PreviewSnapshot,
  templateImage: HTMLImageElement,
  kind: PreviewKind,
): boolean {
  if (
    controller.status.type !== "ready"
    || (controller.mode === "crop" && controller.crop === null)
  ) {
    return false;
  }
  const context = canvas.getContext("2d");
  if (context === null) {
    return false;
  }
  const state: RenderState = {
    species: controller.status.selection.species,
    form: controller.status.selection.form,
    templateImage,
    sourceImage: controller.status.image,
    mode: controller.mode,
    ...(controller.crop === null
      ? {}
      : { cropTransform: controller.crop }),
  };
  renderPlan(
    context,
    kind === "question"
      ? buildQuestionPlan(state)
      : buildAnswerPlan(state),
  );
  return true;
}

export async function exportPreview(
  controller: PreviewSnapshot,
  templateImage: HTMLImageElement,
  kind: PreviewKind,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE.width;
  canvas.height = CANVAS_SIZE.height;
  if (!renderPreviewCanvas(canvas, controller, templateImage, kind)) {
    return;
  }

  const file = kind === "question"
    ? await controller.exportQuestion(canvas)
    : await controller.exportAnswer(canvas);
  downloadBlob(file.blob, file.filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
