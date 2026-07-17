import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { getFormDisplayName } from "./display-name";

describe("getFormDisplayName", () => {
  it("uses zhHans when available", () => {
    const form = manifestFixture.species[0].forms[0];
    expect(getFormDisplayName(form)).toBe("妙蛙种子");
  });

  it("falls back to en when zhHans is missing", () => {
    const form = {
      ...manifestFixture.species[1].forms[0],
      names: { en: "Pikachu Belle" },
    };
    expect(getFormDisplayName(form)).toBe("Pikachu Belle");
  });

  it('appends female suffix only when gender is "female"', () => {
    const femaleForm = manifestFixture.species[1].forms[1];
    const defaultForm = manifestFixture.species[1].forms[0];

    expect(getFormDisplayName(femaleForm)).toBe("摇滚明星皮卡丘（雌性）");
    expect(getFormDisplayName(defaultForm)).toBe("皮卡丘");
  });
});
