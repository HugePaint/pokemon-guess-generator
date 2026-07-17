export const POKE_API_BASE_URL = "https://pokeapi.co/api/v2" as const;
export const SPRITES_COMMIT = "bf4c47ac82c33b330e33d98b8882d1cedb2f53e7" as const;
export const SPRITES_CDN_PREFIX =
  `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITES_COMMIT}/` as const;
export const REQUEST_CONCURRENCY = 4;
export const REQUEST_RETRIES = 3;
