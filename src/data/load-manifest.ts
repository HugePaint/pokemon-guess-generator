import { PokemonManifestSchema, type PokemonManifest } from "../domain/pokemon";

export async function loadManifest(
  url = "./data/pokemon.json",
  fetcher: typeof fetch = fetch,
): Promise<PokemonManifest> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`图鉴数据加载失败：${response.status}`);
  const result = PokemonManifestSchema.safeParse(await response.json());
  if (!result.success) throw new Error(`图鉴数据格式无效：${result.error.issues[0]?.message ?? "未知错误"}`);
  return result.data;
}
