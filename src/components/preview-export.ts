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
    throw new Error("浏览器不支持 Canvas 2D");
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

export function downloadBlob(blob: Blob, filename: string): void {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } catch (error) {
    throw new Error("浏览器无法启动下载", { cause: error });
  } finally {
    if (url !== null) {
      const objectUrl = url;
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Revocation is best-effort after the browser has consumed the URL.
        }
      }, 1_000);
    }
  }
}
