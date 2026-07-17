import { describe, expect, it, vi } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { renderPlan } from "./canvas-renderer";
import {
  buildAnswerPlan,
  buildQuestionPlan,
  type RenderState,
} from "./render-plan";

const pikachu = manifestFixture.species[1];
const defaultForm = pikachu.forms[0];
const templateImage = { naturalWidth: 1024, naturalHeight: 768 } as HTMLImageElement;
const sourceImage = { naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement;

const questionStateFixture: RenderState = {
  species: pikachu,
  form: defaultForm,
  templateImage,
  sourceImage,
  mode: "silhouette",
};

const answerStateFixture: RenderState = {
  ...questionStateFixture,
  mode: "crop",
  cropTransform: {
    scale: 2,
    offsetX: -100,
    offsetY: -200,
    fallback: false,
  },
};

describe("render plans", () => {
  it("keeps question art inside the template content rectangle", () => {
    const plan = buildQuestionPlan(questionStateFixture);

    expect(plan.clipRect).toEqual({ x: 70, y: 75, width: 320, height: 380 });
    expect(plan.canvasSize).toEqual({ width: 1024, height: 768 });
    expect(plan.art).toMatchObject({
      destination: { x: 70, y: 185, width: 320, height: 160 },
      silhouette: true,
    });
  });

  it("uses the supplied transform for a crop question", () => {
    const plan = buildQuestionPlan(answerStateFixture);

    expect(plan.art).toMatchObject({
      destination: { x: -100, y: -200, width: 400, height: 200 },
      silhouette: false,
    });
  });

  it("covers question copy and adds answer copy", () => {
    const plan = buildAnswerPlan(answerStateFixture);

    expect(plan.answerPanel).toEqual({
      rect: { x: 520, y: 100, width: 400, height: 230 },
      fill: "#365c81",
    });
    expect(plan.answerLines.map((line) => line.text)).toEqual([
      "皮卡丘",
      "Pikachu",
      "No.0025",
      "默认形态",
    ]);
  });

  it("always contain-fits full-color answer art and returns immutable plans", () => {
    const plan = buildAnswerPlan(answerStateFixture);

    expect(plan.art).toMatchObject({
      destination: { x: 70, y: 185, width: 320, height: 160 },
      silhouette: false,
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.art)).toBe(true);
    expect(Object.isFrozen(plan.art.destination)).toBe(true);
    expect(Object.isFrozen(plan.answerLines)).toBe(true);
    expect(Object.isFrozen(plan.answerLines[0])).toBe(true);
  });
});

describe("renderPlan", () => {
  it("executes an answer plan in composition order", () => {
    const plan = buildAnswerPlan(answerStateFixture);
    const context = {
      canvas: { width: 300, height: 150 },
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

    renderPlan(context, plan);

    expect(context.canvas.width).toBe(1024);
    expect(context.canvas.height).toBe(768);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1024, 768);
    expect(context.drawImage).toHaveBeenNthCalledWith(
      1,
      templateImage,
      0,
      0,
      1024,
      768,
    );
    expect(context.rect).toHaveBeenCalledWith(70, 75, 320, 380);
    expect(context.drawImage).toHaveBeenNthCalledWith(
      2,
      sourceImage,
      70,
      185,
      320,
      160,
    );
    expect(context.fillRect).toHaveBeenCalledWith(520, 100, 400, 230);
    expect(context.fillText).toHaveBeenCalledTimes(4);
    expect(context.fillText).toHaveBeenNthCalledWith(
      1,
      "皮卡丘",
      720,
      135,
      352,
    );

    const clearOrder = vi.mocked(context.clearRect).mock.invocationCallOrder[0]!;
    const templateOrder = vi.mocked(context.drawImage).mock.invocationCallOrder[0]!;
    const saveOrder = vi.mocked(context.save).mock.invocationCallOrder[0]!;
    const artOrder = vi.mocked(context.drawImage).mock.invocationCallOrder[1]!;
    const restoreOrder = vi.mocked(context.restore).mock.invocationCallOrder[0]!;
    const panelOrder = vi.mocked(context.fillRect).mock.invocationCallOrder[0]!;
    const textOrder = vi.mocked(context.fillText).mock.invocationCallOrder[0]!;

    expect([
      clearOrder,
      templateOrder,
      saveOrder,
      artOrder,
      restoreOrder,
      panelOrder,
      textOrder,
    ]).toEqual([...[
      clearOrder,
      templateOrder,
      saveOrder,
      artOrder,
      restoreOrder,
      panelOrder,
      textOrder,
    ]].sort((left, right) => left - right));
  });
});
