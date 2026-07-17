import { PokemonManifestSchema, type PokemonManifest } from "../../src/domain/pokemon";
import { auditManifest, printAuditReport } from "./audit-lib";
import { findOmittedFormIds, normalizeSpecies, type SpeciesBundle } from "./normalize";
import { fetchJson, mapWithConcurrency } from "./pokeapi-client";
import {
  POKE_API_BASE_URL,
  REQUEST_CONCURRENCY,
  SPRITES_COMMIT,
} from "./source-config";
import { publishJsonPair } from "./sync-publish";

type ApiReference = { name: string; url: string };
type PokemonResource = SpeciesBundle["pokemon"] & { forms: ApiReference[] };
type SpeciesResource = SpeciesBundle["species"] & {
  varieties: Array<{ is_default: boolean; pokemon: ApiReference }>;
};
type PokemonFormResource = SpeciesBundle["forms"][number];

type SyncOptions = { refresh: boolean; limit?: number };

function parseOptions(args: string[]): SyncOptions {
  let refresh = false;
  let limit: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) throw new Error("参数不能为空");
    if (arg === "--refresh") {
      refresh = true;
    } else if (/^[1-9]\d*$/.test(arg) && args.length === 1) {
      // npm 11 treats `--limit 3` as an npm config and forwards only `3`.
      limit = Number(arg);
    } else if (arg === "--limit") {
      const value = args[index + 1];
      if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new Error("--limit 必须是正整数");
      }
      limit = Number(value);
      index += 1;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return { refresh, limit };
}

async function loadBundle(
  reference: ApiReference,
  refresh: boolean,
): Promise<SpeciesBundle> {
  const species = await fetchJson<SpeciesResource>(reference.url, fetch, { refresh });
  const pokemon: PokemonResource[] = [];
  for (const variety of species.varieties) {
    pokemon.push(await fetchJson<PokemonResource>(variety.pokemon.url, fetch, { refresh }));
  }

  const formUrls = [...new Set(pokemon.flatMap((entry) => entry.forms.map((form) => form.url)))];
  const forms: PokemonFormResource[] = [];
  for (const url of formUrls) {
    forms.push(await fetchJson<PokemonFormResource>(url, fetch, { refresh }));
  }

  return {
    species,
    pokemon: pokemon.find((entry) => entry.name === species.name) ?? pokemon[0]!,
    varietyPokemon: pokemon,
    forms,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const list = await fetchJson<{ results: ApiReference[] }>(
    `${POKE_API_BASE_URL}/pokemon-species?limit=${options.limit ?? 1025}&offset=0`,
    fetch,
    { refresh: options.refresh },
  );
  const references = options.limit === undefined ? list.results : list.results.slice(0, options.limit);
  const bundles = await mapWithConcurrency(
    references,
    REQUEST_CONCURRENCY,
    (reference) => loadBundle(reference, options.refresh),
  );
  const omittedForms: string[] = [];
  const species = bundles.flatMap((bundle) => {
    omittedForms.push(...findOmittedFormIds(bundle));
    const record = normalizeSpecies(bundle);
    if (record.forms.length === 0) {
      omittedForms.push(`${record.id}:${record.slug}`);
      return [];
    }
    return [record];
  });

  const manifest: PokemonManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      pokeApiBaseUrl: POKE_API_BASE_URL,
      spritesCommit: SPRITES_COMMIT,
    },
    species,
  };
  const parsed = PokemonManifestSchema.parse(manifest);
  const report = auditManifest(parsed, { omittedForms, limit: options.limit });
  printAuditReport(report);
  if (!report.valid) {
    throw new Error(`同步审计失败：${JSON.stringify(report)}`);
  }

  const manifestFile = "public/data/pokemon.json";
  const auditFile = "public/data/audit-report.json";
  await publishJsonPair(
    manifestFile,
    `${JSON.stringify(parsed, null, 2)}\n`,
    auditFile,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(`同步完成：${parsed.species.length} 个物种，${report.formCount} 个形态`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
