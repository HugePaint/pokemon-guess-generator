import type { ArtInstruction, RenderPlan } from "./render-plan";

export function renderPlan(
  context: CanvasRenderingContext2D,
  plan: RenderPlan,
): void {
  const { width, height } = plan.canvasSize;
  context.canvas.width = width;
  context.canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(plan.templateImage, 0, 0, width, height);

  context.save();
  context.beginPath();
  context.rect(
    plan.clipRect.x,
    plan.clipRect.y,
    plan.clipRect.width,
    plan.clipRect.height,
  );
  context.clip();
  drawArt(context, plan.art);
  context.restore();

  if (plan.answerPanel !== undefined) {
    context.fillStyle = plan.answerPanel.fill;
    context.fillRect(
      plan.answerPanel.rect.x,
      plan.answerPanel.rect.y,
      plan.answerPanel.rect.width,
      plan.answerPanel.rect.height,
    );
  }

  for (const line of plan.answerLines) {
    context.fillStyle = line.fill;
    context.font = line.font;
    context.textAlign = line.align;
    context.textBaseline = line.baseline;
    context.fillText(line.text, line.x, line.y);
  }
}

function drawArt(
  context: CanvasRenderingContext2D,
  art: Readonly<ArtInstruction>,
): void {
  const { x, y, width, height } = art.destination;

  if (!art.silhouette) {
    context.drawImage(art.source, x, y, width, height);
    return;
  }

  const surface = document.createElement("canvas");
  surface.width = Math.max(1, Math.ceil(width));
  surface.height = Math.max(1, Math.ceil(height));
  const silhouetteContext = surface.getContext("2d");
  if (silhouetteContext === null) {
    throw new Error("浏览器不支持剪影渲染");
  }
  silhouetteContext.drawImage(art.source, 0, 0, surface.width, surface.height);
  silhouetteContext.globalCompositeOperation = "source-in";
  silhouetteContext.fillStyle = "#000000";
  silhouetteContext.fillRect(0, 0, surface.width, surface.height);
  context.drawImage(surface, x, y, width, height);
}
