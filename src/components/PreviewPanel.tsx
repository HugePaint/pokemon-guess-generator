import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeneratorController,
  PreviewKind,
} from "../features/generator/use-generator";
import { renderPlan } from "../features/rendering/canvas-renderer";
import { loadFirstImage } from "../features/rendering/load-image";
import {
  buildAnswerPlan,
  buildQuestionPlan,
  type RenderState,
} from "../features/rendering/render-plan";
import { CANVAS_SIZE, TEMPLATE_URL } from "../features/rendering/template";

export interface PreviewPanelProps {
  readonly controller: GeneratorController;
  readonly templateImage?: HTMLImageElement;
}

export function PreviewPanel({
  controller,
  templateImage: suppliedTemplate,
}: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragPointer = useRef<number | null>(null);
  const [loadedTemplate, setLoadedTemplate] = useState<HTMLImageElement | null>(
    suppliedTemplate ?? null,
  );
  const [templateError, setTemplateError] = useState(false);
  const [templateAttempt, setTemplateAttempt] = useState(0);
  const templateImage = suppliedTemplate ?? loadedTemplate;

  useEffect(() => {
    if (suppliedTemplate !== undefined) {
      setLoadedTemplate(suppliedTemplate);
      setTemplateError(false);
      return;
    }
    let active = true;
    setTemplateError(false);
    void loadFirstImage([TEMPLATE_URL]).then(
      (image) => {
        if (active) {
          setLoadedTemplate(image);
        }
      },
      () => {
        if (active) {
          setTemplateError(true);
          setLoadedTemplate(null);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [suppliedTemplate, templateAttempt]);

  const renderKind = useCallback((kind: PreviewKind): boolean => {
    const canvas = canvasRef.current;
    if (
      canvas === null
      || templateImage === null
      || controller.status.type !== "ready"
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
  }, [controller.crop, controller.mode, controller.status, templateImage]);

  useEffect(() => {
    renderKind(controller.previewKind);
  }, [controller.previewKind, renderKind]);

  const download = async (kind: PreviewKind) => {
    const canvas = canvasRef.current;
    if (canvas === null || !renderKind(kind)) {
      return;
    }
    try {
      const file = kind === "question"
        ? await controller.exportQuestion(canvas)
        : await controller.exportAnswer(canvas);
      downloadBlob(file.blob, file.filename);
    } catch {
      // The controller exposes a retryable aria-live message.
    } finally {
      if (kind !== controller.previewKind) {
        renderKind(controller.previewKind);
      }
    }
  };

  const statusMessage = getStatusMessage(
    controller,
    templateImage,
    templateError,
  );
  const downloadDisabled = !controller.canDownload || templateImage === null;

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="preview-heading">
        <h2 id="preview-title">图片预览</h2>
        <div className="preview-tabs" role="tablist" aria-label="预览类型">
          <button
            type="button"
            role="tab"
            aria-selected={controller.previewKind === "question"}
            onClick={() => controller.setPreviewKind("question")}
          >
            题面预览
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={controller.previewKind === "answer"}
            onClick={() => controller.setPreviewKind("answer")}
          >
            答案预览
          </button>
        </div>
      </div>

      <div className="preview-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE.width}
          height={CANVAS_SIZE.height}
          role="img"
          aria-label="生成图片预览"
          onPointerDown={(event) => {
            if (controller.mode !== "crop") {
              return;
            }
            dragPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              dragPointer.current !== event.pointerId
              || controller.mode !== "crop"
            ) {
              return;
            }
            const canvas = event.currentTarget;
            const bounds = canvas.getBoundingClientRect();
            if (bounds.width === 0 || bounds.height === 0) {
              return;
            }
            const scaleX = canvas.width / bounds.width;
            const scaleY = canvas.height / bounds.height;
            controller.dragCrop(
              event.nativeEvent.movementX * scaleX,
              event.nativeEvent.movementY * scaleY,
            );
          }}
          onPointerUp={(event) => {
            dragPointer.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={() => {
            dragPointer.current = null;
          }}
        />
      </div>

      <div className="preview-status" role="status" aria-live="polite">
        {statusMessage}
      </div>
      {controller.status.type === "error" && (
        <button type="button" onClick={() => void controller.retryImage()}>
          重试图片
        </button>
      )}
      {templateError && (
        <button
          type="button"
          onClick={() => setTemplateAttempt((value) => value + 1)}
        >
          重试预览模板
        </button>
      )}
      <div className="download-actions">
        <button
          className="primary-button"
          type="button"
          disabled={downloadDisabled}
          onClick={() => void download("question")}
        >
          下载题面
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={downloadDisabled}
          onClick={() => void download("answer")}
        >
          下载答案
        </button>
      </div>
    </section>
  );
}

function getStatusMessage(
  controller: GeneratorController,
  templateImage: HTMLImageElement | null,
  templateError: boolean,
): string {
  if (controller.exportMessage !== "") {
    return controller.exportMessage;
  }
  if (templateError) {
    return "预览模板加载失败，请重试";
  }
  if (controller.status.type === "loading-image") {
    return "正在加载宝可梦图片…";
  }
  if (controller.status.type === "error") {
    return controller.status.message;
  }
  if (controller.status.type === "idle") {
    return "请选择或随机一只宝可梦";
  }
  return templateImage === null ? "正在加载预览模板…" : "图片已准备好";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
