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

  context.save();
  context.drawImage(art.source, x, y, width, height);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#000000";
  context.fillRect(x, y, width, height);
  context.restore();
}
