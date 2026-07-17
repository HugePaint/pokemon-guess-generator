import { describe, expect, it } from "vitest";
import manifestJson from "../../public/data/pokemon.json";
import { PokemonManifestSchema } from "../domain/pokemon";
import { buildAnswerPlan, type RenderState } from "../features/rendering/render-plan";
import { chooseRandomPokemon } from "../features/selection/random";

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
}

describe("production manifest", () => {
  it("parses and always returns a form owned by the selected species", () => {
    const manifest = PokemonManifestSchema.parse(manifestJson);
    const rng = seededRandom(20260717);
    for (let index = 0; index < 10_000; index += 1) {
      const selection = chooseRandomPokemon(manifest.species, rng);
      expect(selection.species.forms).toContain(selection.form);
    }
  });

  it("fits every one of the 1,627 form answers inside the padded answer region", () => {
    const manifest = PokemonManifestSchema.parse(manifestJson);
    const templateImage = { naturalWidth: 1024, naturalHeight: 768 } as HTMLImageElement;
    const sourceImage = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement;
    let formsChecked = 0;

    for (const species of manifest.species) {
      for (const form of species.forms) {
        const state: RenderState = {
          species,
          form,
          templateImage,
          sourceImage,
          mode: "silhouette",
        };
        const plan = buildAnswerPlan(state);
        const expectedFormName = form.isDefault
          ? "默认形态"
          : `${form.names.zhHans ?? form.names.en}${form.gender === "female" ? "（雌性）" : ""}`;

        expect(plan.answerLines.map((line) => line.text)).toEqual([
          species.names.zhHans,
          species.names.en,
          `No.${String(species.id).padStart(4, "0")}`,
          expectedFormName,
        ]);
        for (const line of plan.answerLines) {
          expect(line.maxWidth).toBe(352);
          expect(line.x - line.maxWidth / 2).toBeGreaterThanOrEqual(544);
          expect(line.x + line.maxWidth / 2).toBeLessThanOrEqual(896);
        }
        formsChecked += 1;
      }
    }

    expect(formsChecked).toBe(1_627);
  });
});
