import { z } from "zod";

export const PokemonGenderSchema = z.enum(["unspecified", "male", "female"]);
export type PokemonGender = z.infer<typeof PokemonGenderSchema>;

export const PokemonFormRecordSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  names: z.object({ zhHans: z.string().min(1).optional(), en: z.string().min(1) }),
  isDefault: z.boolean(),
  gender: PokemonGenderSchema,
  flags: z.object({
    isMega: z.boolean(),
    isBattleOnly: z.boolean(),
    isCosmetic: z.boolean(),
  }),
  imageCandidates: z.array(z.string().url()).min(1),
});

export const PokemonSpeciesRecordSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  names: z.object({ zhHans: z.string().min(1), en: z.string().min(1) }),
  forms: z.array(PokemonFormRecordSchema).min(1),
});

export const PokemonManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  source: z.object({
    pokeApiBaseUrl: z.literal("https://pokeapi.co/api/v2"),
    spritesCommit: z.literal("bf4c47ac82c33b330e33d98b8882d1cedb2f53e7"),
  }),
  species: z.array(PokemonSpeciesRecordSchema).min(1),
});

export type PokemonFormRecord = z.infer<typeof PokemonFormRecordSchema>;
export type PokemonSpeciesRecord = z.infer<typeof PokemonSpeciesRecordSchema>;
export type PokemonManifest = z.infer<typeof PokemonManifestSchema>;
