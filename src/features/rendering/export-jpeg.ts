import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../domain/pokemon";
import { JPEG_QUALITY } from "./template";

export type ExportKind = "question" | "answer";

type FilenameSpecies = Pick<PokemonSpeciesRecord, "id" | "slug">;
type FilenameForm = Pick<PokemonFormRecord, "slug" | "isDefault">;

export interface ExportedJpeg {
  readonly blob: Blob;
  readonly filename: string;
}

export function exportJpeg(
  canvas: HTMLCanvasElement,
  species: FilenameSpecies,
  form: FilenameForm,
  kind: ExportKind,
): Promise<ExportedJpeg> {
  const id = String(species.id).padStart(4, "0");
  const speciesSlug = sanitizeSlug(species.slug);
  const formSuffix = form.isDefault ? "" : `-${sanitizeSlug(form.slug)}`;
  const filename = `${id}-${speciesSlug}${formSuffix}-${kind}.jpg`;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("JPG 导出失败"));
        return;
      }

      resolve({ blob, filename });
    }, "image/jpeg", JPEG_QUALITY);
  });
}

function sanitizeSlug(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "pokemon";
}
