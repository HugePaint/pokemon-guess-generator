import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type {
  GeneratorController,
  PreviewKind,
} from "../features/generator/use-generator";
import { CANVAS_SIZE } from "../features/rendering/template";
import { exportPreview, renderPreviewCanvas } from "./preview-export";
import { useTemplateImage } from "./use-template-image";

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
  const questionTabRef = useRef<HTMLButtonElement>(null);
  const answerTabRef = useRef<HTMLButtonElement>(null);
  const {
    image: templateImage,
    hasError: templateError,
    retry: retryTemplate,
  } = useTemplateImage(suppliedTemplate);

  const renderKind = useCallback((kind: PreviewKind): boolean => {
    const canvas = canvasRef.current;
    if (canvas === null || templateImage === null) {
      return false;
    }
    return renderPreviewCanvas(canvas, controller, templateImage, kind);
  }, [controller.crop, controller.mode, controller.status, templateImage]);

  useEffect(() => {
    renderKind(controller.previewKind);
  }, [controller.previewKind, renderKind]);

  const download = async (kind: PreviewKind) => {
    if (templateImage === null) {
      return;
    }
    try {
      await exportPreview(controller, templateImage, kind);
    } catch {
      // The controller exposes a retryable aria-live message.
    }
  };

  const statusMessage = getStatusMessage(
    controller,
    templateImage,
    templateError,
  );
  const downloadDisabled = !controller.canDownload || templateImage === null;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextKind: PreviewKind | null = null;
    if (event.key === "ArrowRight") {
      nextKind = controller.previewKind === "question" ? "answer" : "question";
    } else if (event.key === "ArrowLeft") {
      nextKind = controller.previewKind === "question" ? "answer" : "question";
    } else if (event.key === "End") {
      nextKind = "answer";
    } else if (event.key === "Home") {
      nextKind = "question";
    }
    if (nextKind === null) {
      return;
    }
    event.preventDefault();
    controller.setPreviewKind(nextKind);
    (nextKind === "question" ? questionTabRef : answerTabRef).current?.focus();
  };
  const previewCanvas = (
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
  );

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="preview-heading">
        <h2 id="preview-title">图片预览</h2>
        <div className="preview-tabs" role="tablist" aria-label="预览类型">
          <button
            ref={questionTabRef}
            id="question-preview-tab"
            type="button"
            role="tab"
            aria-controls="question-preview-panel"
            aria-selected={controller.previewKind === "question"}
            tabIndex={controller.previewKind === "question" ? 0 : -1}
            onClick={() => controller.setPreviewKind("question")}
            onKeyDown={handleTabKeyDown}
          >
            题面预览
          </button>
          <button
            ref={answerTabRef}
            id="answer-preview-tab"
            type="button"
            role="tab"
            aria-controls="answer-preview-panel"
            aria-selected={controller.previewKind === "answer"}
            tabIndex={controller.previewKind === "answer" ? 0 : -1}
            onClick={() => controller.setPreviewKind("answer")}
            onKeyDown={handleTabKeyDown}
          >
            答案预览
          </button>
        </div>
      </div>

      <div
        id="question-preview-panel"
        role="tabpanel"
        aria-labelledby="question-preview-tab"
        hidden={controller.previewKind !== "question"}
      >
        {controller.previewKind === "question" && (
          <div className="preview-canvas-wrapper">{previewCanvas}</div>
        )}
      </div>
      <div
        id="answer-preview-panel"
        role="tabpanel"
        aria-labelledby="answer-preview-tab"
        hidden={controller.previewKind !== "answer"}
      >
        {controller.previewKind === "answer" && (
          <div className="preview-canvas-wrapper">{previewCanvas}</div>
        )}
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
          onClick={retryTemplate}
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
