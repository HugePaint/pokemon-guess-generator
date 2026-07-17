import type { PokemonFormRecord } from "../../domain/pokemon";

export function getFormDisplayName(form: PokemonFormRecord): string {
  const baseName = form.names.zhHans ?? form.names.en;
  if (form.gender !== "female") {
    return baseName;
  }

  return `${baseName}（雌性）`;
}
