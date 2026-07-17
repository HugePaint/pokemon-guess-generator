# 宝可梦“我是谁”图片生成器 Implementation Plan
> 请注意本文档由LLM AI生成。
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可部署到 GitHub Pages 的纯前端工具，按指定或随机宝可梦生成 1024×768 的剪影/局部题面 JPG 与答案 JPG。

**Architecture:** 使用显式执行的数据同步脚本把 PokéAPI 物种、变种、外观形态与图片候选转换为版本化静态清单；浏览器只加载清单，不在运行时枚举 PokéAPI。React 工作台管理选择和裁剪状态，纯 TypeScript 模块完成随机、像素与布局计算，Canvas 适配层负责模板合成和 JPEG 导出。

**Tech Stack:** Node.js 24.16.0、React 19.2.7、TypeScript 7.0.2、Vite 8.1.5、Zod 4.4.3、Vitest 4.1.10、Testing Library 16.3.2、Playwright 1.61.1、GitHub Actions/Pages。

## Global Constraints
- 运行时必须是纯静态网页，不增加后端、数据库、登录、计分或答题流程。
- 题面和答案固定输出 1024×768 JPEG，编码质量为 `0.92`。
- 使用用户提供的 1024×768 模板；初始内容区域为 `{ x: 70, y: 75, width: 320, height: 380 }`，答案文字区域为 `{ x: 520, y: 100, width: 400, height: 230 }`。
- 随机必须先等概率选择物种，再等概率选择该物种下的可用形态。
- 随机裁剪使用完整居中比例的 1.5～3.0 倍缩放，框内非透明像素至少覆盖内容区域 15%，最多展示源图 70% 的非透明像素，最多尝试 20 次。
- PokéAPI sprites 固定到提交 `bf4c47ac82c33b330e33d98b8882d1cedb2f53e7`；非默认外观形态不得回退到基础形态图片。
- 52Poké 不作为第一版的数据源或图片源。
- GitHub Actions 只审计已提交的静态清单，不在部署时同步 PokéAPI。
- 页面必须显示非官方、非商业、素材来源和权利归属声明；该声明不得表述为已获得授权。

---

## File Map
- `package.json`：固定脚本、运行时依赖与开发依赖。
- `vite.config.ts`、`tsconfig*.json`、`playwright.config.ts`：构建与测试配置。
- `src/domain/pokemon.ts`：Zod 清单契约及其 TypeScript 类型。
- `src/data/load-manifest.ts`：浏览器清单加载与错误边界。
- `scripts/data/`：PokéAPI 客户端、规范化、图片 URL 固定、审计及原子写入。
- `public/data/pokemon.json`：提交到仓库的完整静态清单。
- `public/data/audit-report.json`：缺图、名称回退和统计报告。
- `src/features/selection/`：搜索、名称显示和物种优先随机。
- `src/features/rendering/`：图片候选加载、透明像素分析、剪影、裁剪、模板布局、Canvas 绘制和 JPEG 导出。
- `src/features/generator/`：把清单、选择、模式、裁剪和加载状态组合成页面状态。
- `src/components/`：双栏工作台、选择控件、模式控件、预览、下载和法律声明。
- `src/assets/who-am-i-template.png`：用户提供的题面模板。
- `src/test/fixtures/`：小型清单和像素缓冲测试数据。
- `e2e/`：真实浏览器中的生成、导出和响应式测试。
- `.github/workflows/ci-pages.yml`：检查与 GitHub Pages 部署。
- `README.md`：本地开发、数据更新、部署与素材声明。

### Task 1: Bootstrap the tested static application

**Files:**
- Create: `package.json`
- Create: `package-lock.json`（由 `npm install` 生成）
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles.css`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `App(): JSX.Element`
- Produces: npm scripts `dev`, `build`, `test`, `test:watch`, `test:e2e`, `data:sync`, `data:audit`, `check`

- [ ] **Step 1: Add the exact package manifest and install dependencies**

```json
{
  "name": "pokemon-guess-generator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24.16.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "data:sync": "tsx scripts/data/sync.ts",
    "data:audit": "tsx scripts/data/audit.ts public/data/pokemon.json",
    "check": "npm run test && npm run data:audit && npm run build"
  },
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "jsdom": "29.1.1",
    "tsx": "4.23.1",
    "typescript": "7.0.2",
    "vite": "8.1.5",
    "vitest": "4.1.10"
  }
}
```

Run: `npm install`
Expected: `package-lock.json` is created and npm exits with code 0.

Add `.cache/`, `dist/`, `node_modules/`, `playwright-report/` and `test-results/` to `.gitignore`; preserve the existing `.superpowers/` rule.

- [ ] **Step 2: Configure Vite, TypeScript and Vitest**

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

`tsconfig.app.json` must use `target: "ES2023"`, `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, `resolveJsonModule: true` and include `src`. `tsconfig.node.json` must include `vite.config.ts`, `playwright.config.ts` and `scripts`. The root `tsconfig.json` must reference both projects.

- [ ] **Step 3: Write the failing application smoke test**

```tsx
// src/app/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the generator heading and disabled downloads", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "宝可梦“我是谁”图片生成器" })).toBeVisible();
    expect(screen.getByRole("button", { name: "下载题面" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下载答案" })).toBeDisabled();
  });
});
```

- [ ] **Step 4: Run the test and verify the red state**

Run: `npm test -- src/app/App.test.tsx`
Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 5: Add the minimal application shell**

```tsx
// src/app/App.tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>宝可梦“我是谁”图片生成器</h1>
      <div className="workspace">
        <section aria-label="生成设置">请选择一只宝可梦</section>
        <section aria-label="图片预览">
          <button disabled>下载题面</button>
          <button disabled>下载答案</button>
        </section>
      </div>
    </main>
  );
}
```

`src/main.tsx` must create a React root, render `<App />` inside `StrictMode`, and import `src/styles.css`. Add a desktop two-column `.workspace` and a `@media (max-width: 760px)` single-column rule.

- [ ] **Step 6: Verify the foundation**

Run: `npm test -- src/app/App.test.tsx`
Expected: PASS.

Run: `npm run build`
Expected: `dist/index.html` is generated without TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json index.html vite.config.ts tsconfig*.json src
git commit -m "chore: bootstrap tested static app"
```

### Task 2: Define and load the static manifest

**Files:**
- Create: `src/domain/pokemon.ts`
- Create: `src/data/load-manifest.ts`
- Create: `src/data/load-manifest.test.ts`
- Create: `src/test/fixtures/pokemon-manifest.ts`
- Create: `public/data/pokemon.json`（先使用两物种测试清单，Task 8 替换为完整清单）

**Interfaces:**
- Produces: `PokemonManifestSchema`
- Produces: `PokemonManifest`, `PokemonSpeciesRecord`, `PokemonFormRecord`, `PokemonGender`
- Produces: `loadManifest(url?: string, fetcher?: typeof fetch): Promise<PokemonManifest>`

- [ ] **Step 1: Write schema and loader failure tests**

```ts
// src/data/load-manifest.test.ts
import { describe, expect, it, vi } from "vitest";
import { loadManifest } from "./load-manifest";
import { manifestFixture } from "../test/fixtures/pokemon-manifest";

describe("loadManifest", () => {
  it("parses a valid manifest", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifestFixture)));
    await expect(loadManifest("/data/pokemon.json", fetcher)).resolves.toEqual(manifestFixture);
  });

  it("reports an invalid manifest instead of returning partial data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"schemaVersion":1,"species":[]}'));
    await expect(loadManifest("/data/pokemon.json", fetcher)).rejects.toThrow("图鉴数据格式无效");
  });

  it("reports an HTTP failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(loadManifest("/data/pokemon.json", fetcher)).rejects.toThrow("图鉴数据加载失败：503");
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- src/data/load-manifest.test.ts`
Expected: FAIL because the schema and loader do not exist.

- [ ] **Step 3: Implement the exact data contract**

```ts
// src/domain/pokemon.ts
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
```

```ts
// src/data/load-manifest.ts
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
```

Create `manifestFixture` with Bulbasaur and Pikachu, and at least two Pikachu forms, so later random tests can prove species-first weighting. Serialize the same fixture to `public/data/pokemon.json`.

- [ ] **Step 4: Verify schema behavior**

Run: `npm test -- src/data/load-manifest.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/data src/test/fixtures public/data/pokemon.json
git commit -m "feat: define static pokemon manifest"
```

### Task 3: Build the deterministic PokéAPI synchronization and audit pipeline

**Files:**
- Create: `scripts/data/source-config.ts`
- Create: `scripts/data/pokeapi-client.ts`
- Create: `scripts/data/normalize.ts`
- Create: `scripts/data/normalize.test.ts`
- Create: `scripts/data/audit-lib.ts`
- Create: `scripts/data/audit-lib.test.ts`
- Create: `scripts/data/audit.ts`
- Create: `scripts/data/sync.ts`
- Create: `src/test/fixtures/pokeapi.ts`

**Interfaces:**
- Consumes: `PokemonManifestSchema`, `PokemonSpeciesRecord`, `PokemonFormRecord`
- Produces: `pinSpriteUrl(url: string): string`
- Produces: `normalizeSpecies(input: SpeciesBundle): PokemonSpeciesRecord`
- Produces: `auditManifest(manifest: PokemonManifest): AuditReport`
- Produces: CLI `npm run data:sync` and `npm run data:audit`

- [ ] **Step 1: Write normalization tests for pinned URLs and form safety**

```ts
// scripts/data/normalize.test.ts
import { describe, expect, it } from "vitest";
import { normalizeSpecies, pinSpriteUrl } from "./normalize";
import { speciesBundleFixture } from "../../src/test/fixtures/pokeapi";

describe("pinSpriteUrl", () => {
  it("rewrites master raw URLs to the pinned jsDelivr commit", () => {
    expect(pinSpriteUrl(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    )).toBe(
      "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@bf4c47ac82c33b330e33d98b8882d1cedb2f53e7/sprites/pokemon/25.png",
    );
  });
});

describe("normalizeSpecies", () => {
  it("creates a female record only when a female sprite exists", () => {
    const record = normalizeSpecies(speciesBundleFixture);
    expect(record.forms.some((form) => form.gender === "female")).toBe(true);
  });

  it("does not use a base image for a cosmetic form", () => {
    const record = normalizeSpecies(speciesBundleFixture);
    const cosmetic = record.forms.find((form) => form.flags.isCosmetic);
    expect(cosmetic?.imageCandidates).toEqual([
      expect.stringContaining("/sprites/pokemon/other/showdown/25-cap-partner.png"),
    ]);
  });
});
```

The fixture must contain one species resource, one default Pokémon resource, one cosmetic `pokemon-form`, localized `zh-Hans` and `en` names, and distinct default/female/form sprite URLs.

- [ ] **Step 2: Run normalization tests and verify failure**

Run: `npm test -- scripts/data/normalize.test.ts`
Expected: FAIL because normalization is not implemented.

- [ ] **Step 3: Implement source configuration and URL pinning**

```ts
// scripts/data/source-config.ts
export const POKE_API_BASE_URL = "https://pokeapi.co/api/v2" as const;
export const SPRITES_COMMIT = "bf4c47ac82c33b330e33d98b8882d1cedb2f53e7" as const;
export const SPRITES_CDN_PREFIX =
  `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITES_COMMIT}/` as const;
export const REQUEST_CONCURRENCY = 4;
export const REQUEST_RETRIES = 3;
```

`pinSpriteUrl` must accept only `raw.githubusercontent.com/PokeAPI/sprites/master/` URLs, remove that prefix, prepend `SPRITES_CDN_PREFIX`, deduplicate candidates and reject any unrecognized host. Default/variety forms may use official artwork → HOME → front default. Cosmetic forms may use only their own `pokemon-form.sprites.default`; female records may use HOME female → front female. Empty records are omitted and added to the audit report.

- [ ] **Step 4: Implement a bounded, retrying API client**

```ts
// scripts/data/pokeapi-client.ts
export async function fetchJson<T>(url: string, fetcher: typeof fetch = fetch): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": "pokemon-guess-generator/0.1 (+GitHub repository)" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`PokéAPI 请求失败：${url}`, { cause: lastError });
}
```

Add a `mapWithConcurrency(items, 4, mapper)` helper that preserves input order and never runs more than four requests simultaneously. Cache successful JSON responses under `.cache/pokeapi/<sha256-url>.json`; `--refresh` bypasses the cache.

- [ ] **Step 5: Implement normalization and make tests pass**

`normalizeSpecies` must:
- select the `zh-Hans` and `en` localized names;
- normalize varieties before cosmetic forms;
- generate stable IDs in the form `<pokemon-id>:<form-name>:<gender>`;
- synthesize a female record only when a female sprite URL exists;
- mark `isMega` and `isBattleOnly` from `pokemon-form`;
- set `isCosmetic` for non-default `pokemon-form` records sharing the same Pokémon entity;
- sort forms by default first, then English slug, then gender.

Run: `npm test -- scripts/data/normalize.test.ts`
Expected: all normalization tests PASS.

- [ ] **Step 6: Write audit tests**

```ts
// scripts/data/audit-lib.test.ts
import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../src/test/fixtures/pokemon-manifest";
import { auditManifest } from "./audit-lib";

describe("auditManifest", () => {
  it("accepts a valid manifest and reports counts", () => {
    expect(auditManifest(manifestFixture)).toMatchObject({
      valid: true,
      duplicateSpeciesIds: [],
      duplicateFormIds: [],
      speciesCount: 2,
    });
  });

  it("rejects duplicate species IDs", () => {
    const duplicate = { ...manifestFixture, species: [...manifestFixture.species, manifestFixture.species[0]!] };
    expect(auditManifest(duplicate).valid).toBe(false);
  });
});
```

- [ ] **Step 7: Implement audit and atomic synchronization**

`auditManifest` must report: `valid`, species/form counts, duplicate IDs, species missing `zhHans`, invalid/non-pinned URLs, omitted forms, and forms using English-name fallback. `audit.ts` must parse the file with `PokemonManifestSchema`, print one human-readable line per error, and exit 1 when `valid` is false.

`sync.ts` must write `pokemon.json.tmp` and `audit-report.json.tmp`, parse and audit both in memory, then rename them over the committed files only when audit succeeds. Supported CLI arguments are `--refresh` and `--limit <positive integer>`; `--limit` is only for local smoke runs and must be recorded in the report.

Run: `npm test -- scripts/data`
Expected: normalization and audit tests PASS.

Run: `npm run data:sync -- --limit 3`
Expected: three species are written, audit reports `valid: true`, and no `.tmp` file remains.

- [ ] **Step 8: Restore the small committed fixture and commit pipeline code**

Task 8 will perform the full sync. Restore `public/data/pokemon.json` to the Task 2 fixture so this commit does not mix pipeline code with generated bulk data.

```bash
git add scripts src/test/fixtures/pokeapi.ts package.json public/data/pokemon.json
git commit -m "feat: add audited pokeapi sync pipeline"
```

### Task 4: Implement search and species-first random selection

**Files:**
- Create: `src/features/selection/search.ts`
- Create: `src/features/selection/search.test.ts`
- Create: `src/features/selection/random.ts`
- Create: `src/features/selection/random.test.ts`
- Create: `src/features/selection/display-name.ts`
- Create: `src/features/selection/display-name.test.ts`

**Interfaces:**
- Consumes: `PokemonSpeciesRecord[]`
- Produces: `searchSpecies(species, query): PokemonSpeciesRecord[]`
- Produces: `chooseRandomPokemon(species, rng?): { species; form }`
- Produces: `getFormDisplayName(form): string`

- [ ] **Step 1: Write failing deterministic behavior tests**

```ts
// src/features/selection/random.test.ts
import { describe, expect, it } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { chooseRandomPokemon } from "./random";

describe("chooseRandomPokemon", () => {
  it("uses the first random value for species and second for that species form", () => {
    const values = [0.75, 0.99];
    const result = chooseRandomPokemon(manifestFixture.species, () => values.shift()!);
    expect(result.species.slug).toBe("pikachu");
    expect(result.form).toBe(result.species.forms.at(-1));
  });
});
```

```ts
// src/features/selection/search.test.ts
it.each(["妙蛙种子", "bulbasaur", "0001", "1"])("finds by %s", (query) => {
  expect(searchSpecies(manifestFixture.species, query)[0]?.slug).toBe("bulbasaur");
});
```

- [ ] **Step 2: Verify red state**

Run: `npm test -- src/features/selection`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement pure selection functions**

```ts
// src/features/selection/random.ts
import type { PokemonFormRecord, PokemonSpeciesRecord } from "../../domain/pokemon";

export interface PokemonSelection {
  species: PokemonSpeciesRecord;
  form: PokemonFormRecord;
}

export function chooseRandomPokemon(
  records: PokemonSpeciesRecord[],
  rng: () => number = Math.random,
): PokemonSelection {
  if (records.length === 0) throw new Error("没有可用的宝可梦");
  const species = records[Math.min(records.length - 1, Math.floor(rng() * records.length))]!;
  const form = species.forms[Math.min(species.forms.length - 1, Math.floor(rng() * species.forms.length))]!;
  return { species, form };
}
```

Search must be case-insensitive, trim whitespace, match exact numeric IDs after removing leading zeroes, and sort prefix matches before substring matches. `getFormDisplayName` returns `zhHans` when present, otherwise `en`; it appends `（雌性）` only for `gender: "female"`.

- [ ] **Step 4: Verify selection behavior**

Run: `npm test -- src/features/selection`
Expected: all search, random and display-name tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/selection
git commit -m "feat: add pokemon search and random selection"
```

### Task 5: Implement image fallback, silhouette and crop calculations

**Files:**
- Create: `src/features/rendering/types.ts`
- Create: `src/features/rendering/load-image.ts`
- Create: `src/features/rendering/load-image.test.ts`
- Create: `src/features/rendering/pixels.ts`
- Create: `src/features/rendering/pixels.test.ts`
- Create: `src/features/rendering/crop.ts`
- Create: `src/features/rendering/crop.test.ts`

**Interfaces:**
- Produces: `PixelBuffer`, `OpaqueBounds`, `CropTransform`
- Produces: `loadFirstImage(candidates, createImage?): Promise<HTMLImageElement>`
- Produces: `createSilhouette(buffer): PixelBuffer`
- Produces: `findOpaqueBounds(buffer): OpaqueBounds | null`
- Produces: `createRandomCrop(input, rng?): CropTransform`

- [ ] **Step 1: Write failing pixel tests**

```ts
// src/features/rendering/pixels.test.ts
import { expect, it } from "vitest";
import { createSilhouette, findOpaqueBounds } from "./pixels";

const buffer = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 0, 0,
    0, 255, 0, 128, 0, 0, 255, 255,
  ]),
};

it("turns non-transparent pixels black and preserves alpha", () => {
  expect([...createSilhouette(buffer).data]).toEqual([
    0, 0, 0, 255, 0, 0, 0, 0,
    0, 0, 0, 128, 0, 0, 0, 255,
  ]);
});

it("finds the inclusive opaque bounds", () => {
  expect(findOpaqueBounds(buffer)).toEqual({ x: 0, y: 0, width: 2, height: 2, opaquePixels: 3 });
});
```

- [ ] **Step 2: Write failing image fallback and crop tests**

`load-image.test.ts` must prove candidates are tried in order, `crossOrigin` is set to `"anonymous"` before `src`, and the final rejection says `所有图片候选均加载失败`.

`crop.test.ts` must inject fixed random values and assert:
- scale lies between 1.5 and 3.0 times the contain scale;
- a valid candidate is returned within 20 attempts;
- invalid candidates fall back to 2.0 times contain scale centered on opaque bounds;
- empty opaque bounds throw `图片不包含可见像素`.

- [ ] **Step 3: Verify red state**

Run: `npm test -- src/features/rendering`
Expected: FAIL because the rendering modules do not exist.

- [ ] **Step 4: Implement pixel and image modules**

```ts
// src/features/rendering/types.ts
export interface Rect { x: number; y: number; width: number; height: number }
export interface PixelBuffer { width: number; height: number; data: Uint8ClampedArray }
export interface OpaqueBounds extends Rect { opaquePixels: number }
export interface CropTransform { scale: number; offsetX: number; offsetY: number; fallback: boolean }
```

`createSilhouette` must allocate a new `Uint8ClampedArray` and never mutate its input. `findOpaqueBounds` treats alpha greater than zero as visible. `loadFirstImage` must set `crossOrigin` before `src`, resolve only after `decode()` or `load`, and aggregate failed URLs in the final error cause.

- [ ] **Step 5: Implement the exact crop acceptance loop**

```ts
for (let attempt = 0; attempt < 20; attempt += 1) {
  const multiplier = 1.5 + rng() * 1.5;
  const scale = containScale * multiplier;
  const transform = randomTransformWithinBounds(scale, input, rng);
  const metrics = measureVisibleOpaquePixels(transform, input);
  if (metrics.contentCoverage >= 0.15 && metrics.sourceVisibleRatio <= 0.70) {
    return { ...transform, fallback: false };
  }
}
return centeredFallback(input, containScale * 2);
```

`measureVisibleOpaquePixels` must use an alpha mask, not the rectangular source bounds, so transparent margins do not count as content.

- [ ] **Step 6: Verify transformations**

Run: `npm test -- src/features/rendering`
Expected: image fallback, pixel and crop tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/rendering
git commit -m "feat: add image and crop transformations"
```

### Task 6: Compose the template and export deterministic JPEG files

**Files:**
- Create: `src/assets/who-am-i-template.png`
- Create: `src/features/rendering/template.ts`
- Create: `src/features/rendering/render-plan.ts`
- Create: `src/features/rendering/render-plan.test.ts`
- Create: `src/features/rendering/canvas-renderer.ts`
- Create: `src/features/rendering/export-jpeg.ts`
- Create: `src/features/rendering/export-jpeg.test.ts`

**Interfaces:**
- Consumes: selected species/form, loaded source image, mode and optional crop transform
- Produces: `buildQuestionPlan(state): RenderPlan`
- Produces: `buildAnswerPlan(state): RenderPlan`
- Produces: `renderPlan(ctx, plan): void`
- Produces: `exportJpeg(canvas, species, form, kind): Promise<{ blob; filename }>`

- [ ] **Step 1: Add the user-provided template asset**

Move:
`模板图.png`

To:
`src/assets/who-am-i-template.png`

Run:

```powershell
New-Item -ItemType Directory -Force src/assets | Out-Null
Move-Item "模板图.png" "src/assets/who-am-i-template.png"
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path "src/assets/who-am-i-template.png"))
try {
  if ($image.Width -ne 1024 -or $image.Height -ne 768) {
    throw "Template must be 1024x768, got $($image.Width)x$($image.Height)"
  }
} finally {
  $image.Dispose()
}
```

Expected: command exits 0. If dimensions differ, stop; do not silently resize the canonical template.

- [ ] **Step 2: Write failing render-plan tests**

```ts
it("keeps question art inside the template content rectangle", () => {
  const plan = buildQuestionPlan(questionStateFixture);
  expect(plan.clipRect).toEqual({ x: 70, y: 75, width: 320, height: 380 });
  expect(plan.canvasSize).toEqual({ width: 1024, height: 768 });
});

it("covers question copy and adds answer copy", () => {
  const plan = buildAnswerPlan(answerStateFixture);
  expect(plan.answerPanel).toEqual({
    rect: { x: 520, y: 100, width: 400, height: 230 },
    fill: "#24496a",
  });
  expect(plan.answerLines.map((line) => line.text)).toEqual([
    "皮卡丘", "Pikachu", "No.0025", "默认形态",
  ]);
});
```

The answer fill is an initial sampled background color. Add one visual review checkpoint during implementation; if the rectangle is visibly discontinuous, adjust only `ANSWER_PANEL_FILL` and update the test.

- [ ] **Step 3: Write failing JPEG tests**

```ts
it("exports a 0.92 JPEG with a stable filename", async () => {
  const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
    callback(new Blob(["jpeg"], { type: "image/jpeg" }));
    expect(type).toBe("image/jpeg");
    expect(quality).toBe(0.92);
  });
  const canvas = { toBlob } as unknown as HTMLCanvasElement;
  const file = await exportJpeg(canvas, bulbasaur, bulbasaur.forms[0]!, "question");
  expect(file.filename).toBe("0001-bulbasaur-question.jpg");
  expect(file.blob.type).toBe("image/jpeg");
});
```

Also test that a `null` blob rejects with `JPG 导出失败`.

- [ ] **Step 4: Verify red state**

Run: `npm test -- src/features/rendering/render-plan.test.ts src/features/rendering/export-jpeg.test.ts`
Expected: FAIL because composition modules do not exist.

- [ ] **Step 5: Implement immutable plans and Canvas drawing**

```ts
// src/features/rendering/template.ts
export const CANVAS_SIZE = { width: 1024, height: 768 } as const;
export const CONTENT_RECT = { x: 70, y: 75, width: 320, height: 380 } as const;
export const ANSWER_RECT = { x: 520, y: 100, width: 400, height: 230 } as const;
export const ANSWER_PANEL_FILL = "#24496a";
export const ANSWER_TEXT_FILL = "#fff200";
export const JPEG_QUALITY = 0.92;
```

`renderPlan` must draw in this order: clear canvas → template → save/clip content rectangle → question or answer art → restore → optional answer panel → answer text. Answer art always uses contain-fit full color and ignores question crop/silhouette state.

`exportJpeg` must zero-pad species IDs to four digits, sanitize slugs to `[a-z0-9-]`, append form slug only when non-default, and return the Blob without triggering browser download. Keep download side effects in the UI layer.

- [ ] **Step 6: Verify composition**

Run: `npm test -- src/features/rendering`
Expected: all rendering tests PASS.

Run: `npm run build`
Expected: template is fingerprinted into `dist/assets`, build PASS.

- [ ] **Step 7: Commit**

```bash
git add src/assets src/features/rendering
git commit -m "feat: render template and export jpeg"
```

### Task 7: Build generator state and the responsive workbench

**Files:**
- Create: `src/features/generator/use-manifest.ts`
- Create: `src/features/generator/use-generator.ts`
- Create: `src/features/generator/use-generator.test.tsx`
- Create: `src/components/ControlPanel.tsx`
- Create: `src/components/ControlPanel.test.tsx`
- Create: `src/components/PreviewPanel.tsx`
- Create: `src/components/LegalNotice.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: manifest loader, selection functions, rendering functions
- Produces: `useGenerator(manifest): GeneratorController`
- Produces: `ControlPanel`, `PreviewPanel`, `LegalNotice`

- [ ] **Step 1: Write the controller integration tests**

```tsx
it("randomizes species first and enables both downloads after image load", async () => {
  const { result } = renderHook(() => useGenerator(manifestFixture, {
    rng: sequenceRng([0.75, 0.99, 0.5, 0.5]),
    loadImage: vi.fn().mockResolvedValue(imageFixture),
  }));
  await act(async () => { await result.current.randomize(); });
  expect(result.current.selection?.species.slug).toBe("pikachu");
  expect(result.current.canDownload).toBe(true);
});

it("preserves the selection when search has no results", async () => {
  const { result } = renderHook(() => useGenerator(manifestFixture, testDependencies));
  await act(async () => { await result.current.selectSpecies(manifestFixture.species[0]!); });
  const selection = result.current.selection;
  act(() => result.current.setSearch("missing"));
  expect(result.current.selection).toEqual(selection);
  expect(result.current.searchMessage).toBe("未找到匹配的宝可梦");
});
```

Add tests for switching silhouette/crop mode, random crop regeneration, drag offset, zoom clamped to 1.5～3.0 multipliers, manifest retry, image load failure and export error.

- [ ] **Step 2: Verify controller tests fail**

Run: `npm test -- src/features/generator`
Expected: FAIL because hooks do not exist.

- [ ] **Step 3: Implement the controller as an explicit state machine**

Use these statuses:

```ts
type GeneratorStatus =
  | { type: "idle" }
  | { type: "loading-image"; selection: PokemonSelection }
  | { type: "ready"; selection: PokemonSelection; image: HTMLImageElement }
  | { type: "error"; message: string };
```

`GeneratorController` must expose `search`, `searchResults`, `selection`, `mode`, `crop`, `previewKind`, `status`, `canDownload`, and methods for selecting species/form, randomizing, retrying image, changing mode, randomizing crop, dragging, zooming, selecting preview kind and exporting each JPEG.

- [ ] **Step 4: Write workbench component tests**

```tsx
it("shows form selection and crop controls only when applicable", async () => {
  render(<ControlPanel controller={readyControllerFixture} />);
  expect(screen.getByLabelText("形态")).toBeVisible();
  await userEvent.click(screen.getByRole("radio", { name: "区域裁剪" }));
  expect(screen.getByLabelText("缩放")).toBeVisible();
  expect(screen.getByRole("button", { name: "重新随机裁剪" })).toBeVisible();
});
```

`App.test.tsx` must verify loading, retry, no-results, ready and disabled-download states. `LegalNotice` must contain “非官方”“非商业”“The Pokémon Company” and a PokéAPI source link.

- [ ] **Step 5: Implement the accessible two-column UI**

`ControlPanel` uses a labeled search input, result listbox, species/form selectors, random button, mode radio group, crop range input and regenerate button. `PreviewPanel` uses question/answer tabs, a responsive wrapper around the 1024×768 canvas, status text with `aria-live="polite"`, and separate download buttons.

On pointer drag, convert CSS-pixel movement to canvas coordinates with:

```ts
const scaleX = canvas.width / canvas.getBoundingClientRect().width;
const scaleY = canvas.height / canvas.getBoundingClientRect().height;
controller.dragCrop(event.movementX * scaleX, event.movementY * scaleY);
```

CSS requirements:
- desktop `.workspace { grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); }`;
- preview wrapper uses `aspect-ratio: 4 / 3`;
- canvas uses `width: 100%; height: auto`;
- at `max-width: 760px`, use one column with controls before preview;
- visible `:focus-visible` outlines and a minimum 44px touch target for primary buttons.

- [ ] **Step 6: Verify UI behavior**

Run: `npm test -- src/features/generator src/components src/app`
Expected: hook and component tests PASS.

Run: `npm run build`
Expected: production build PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components src/features/generator src/styles.css
git commit -m "feat: build responsive generator workbench"
```

### Task 8: Generate and review the complete versioned data snapshot

**Files:**
- Modify: `public/data/pokemon.json`
- Create: `public/data/audit-report.json`
- Create: `src/data/production-manifest.test.ts`

**Interfaces:**
- Consumes: Task 3 synchronization CLI
- Produces: complete production random pool and auditable omissions

- [ ] **Step 1: Perform a clean full synchronization**

Run: `npm run data:sync -- --refresh`
Expected:
- exits 0;
- `public/data/pokemon.json` parses with schema version 1;
- `audit-report.json` has `valid: true`;
- `source.spritesCommit` equals `bf4c47ac82c33b330e33d98b8882d1cedb2f53e7`;
- no `.tmp` file remains.

- [ ] **Step 2: Audit the committed result independently**

Run: `npm run data:audit`
Expected: PASS and prints non-zero species/form counts with zero duplicate IDs, zero missing species Chinese names and zero non-pinned URLs.

- [ ] **Step 3: Review omissions before accepting the snapshot**

Inspect `audit-report.json`. Every omitted record must include its PokéAPI identifier and one of these machine-readable reasons: `missing-image`, `missing-species-name`, `unsupported-image-host`, or `invalid-form-relation`. Confirm that cosmetic forms never list a base form image candidate.

- [ ] **Step 4: Run selection tests against the production manifest**

Add this ownership test. Do not test statistical fairness with a flaky tolerance; fairness is already proven by the deterministic unit test.

```ts
// src/data/production-manifest.test.ts
import { describe, expect, it } from "vitest";
import manifestJson from "../../public/data/pokemon.json";
import { PokemonManifestSchema } from "../domain/pokemon";
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
});
```

Run: `npm test -- src/data src/features/selection`
Expected: production manifest parse and ownership tests PASS.

- [ ] **Step 5: Commit generated data separately**

```bash
git add public/data/pokemon.json public/data/audit-report.json src/data
git commit -m "data: add versioned pokemon snapshot"
```

### Task 9: Add browser verification, documentation and GitHub Pages deployment

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/generator.spec.ts`
- Create: `e2e/responsive.spec.ts`
- Create: `.github/workflows/ci-pages.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: built application and committed manifest
- Produces: deterministic Chromium acceptance tests and Pages artifact

- [ ] **Step 1: Configure Playwright**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 2: Write deterministic end-to-end tests**

Intercept `**/data/pokemon.json` with `manifestFixture`. Intercept every sprite request and return this SVG with response header `access-control-allow-origin: *` so tests do not depend on the CDN:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path fill="#ffd400" d="M40 170V70L20 20l55 35a65 65 0 1 1-35 115Z"/>
  <circle cx="80" cy="95" r="8" fill="#111"/>
</svg>
```

`generator.spec.ts` must verify:
- search by `皮卡丘` and select a form;
- random selection changes the displayed selection;
- silhouette and crop modes both render non-background pixels inside the content rectangle;
- drag/zoom changes crop state but not Canvas dimensions;
- question and answer buttons download `.jpg` files;
- downloaded files begin with JPEG magic bytes `FF D8 FF`;
- Canvas width/height are 1024/768;
- answer preview contains a full-color pixel and answer text operations complete without error.

`responsive.spec.ts` must assert that the control panel is left of preview at 1280px and above preview at 412px.

- [ ] **Step 3: Run browser tests**

Run: `npx playwright install chromium`
Expected: Chromium installs successfully.

Run: `npm run test:e2e`
Expected: desktop and mobile projects PASS.

- [ ] **Step 4: Add the CI and Pages workflow**

The workflow must:
1. trigger on pull requests and pushes to `main`;
2. use `actions/checkout`, `actions/setup-node` with Node 24 and npm cache;
3. run `npm ci`, `npx playwright install --with-deps chromium`, `npm run check`, and `npm run test:e2e`;
4. upload `dist` with `actions/upload-pages-artifact` only on `main`;
5. deploy with `actions/deploy-pages` in a separate job using `pages: write` and `id-token: write`;
6. never run `npm run data:sync`.

```yaml
# .github/workflows/ci-pages.yml
name: CI and Pages
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run check
      - run: npm run test:e2e
      - if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/configure-pages@v5
      - if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Document operation and constraints**

`README.md` must include:
- Node 24 prerequisite;
- `npm ci`, `npm run dev`, `npm test`, `npm run test:e2e`, `npm run build`;
- explicit data refresh flow: `npm run data:sync -- --refresh` → inspect report → `npm run data:audit` → commit both files;
- GitHub Pages setup;
- PokéAPI and sprites commit attribution;
- template source identified as user-provided;
- non-official/non-commercial disclaimer and explicit statement that it does not grant Pokémon IP rights;
- instructions for replacing the template asset and adjusting only `template.ts`.

Use this document structure and commands:

```markdown
# 宝可梦“我是谁”图片生成器
纯前端的题面与答案 JPG 生成工具，需要 Node.js 24。

## 本地开发
    npm ci
    npm run dev

## 验证与构建
    npm test
    npm run test:e2e
    npm run build

## 更新图鉴数据
    npm run data:sync -- --refresh
    npm run data:audit
检查 `public/data/audit-report.json` 后，同时提交清单和报告。部署流程不会自动访问 PokéAPI。

## 部署
仓库的 `main` 分支通过 `.github/workflows/ci-pages.yml` 验证并部署到 GitHub Pages。

## 素材与权利说明
数据来自 PokéAPI；图片地址固定到 PokeAPI/sprites 提交
`bf4c47ac82c33b330e33d98b8882d1cedb2f53e7`。题面模板由项目使用者提供。
本项目是非官方、非商业项目，与 Nintendo、Game Freak、Creatures 或 The Pokémon Company
不存在隶属或认可关系。相关名称、形象和标志属于各自权利方；本声明不构成使用授权。

## 替换模板
替换 `src/assets/who-am-i-template.png` 后，只在
`src/features/rendering/template.ts` 调整内容和答案区域坐标，并重新运行全部测试。
```

- [ ] **Step 6: Run the full release gate**

Run: `npm run check`
Expected: unit tests, data audit and production build PASS.

Run: `npm run test:e2e`
Expected: Chromium desktop/mobile tests PASS.

Run: `git status --short`
Expected: only intended workflow, docs and E2E files are uncommitted.

- [ ] **Step 7: Commit**

```bash
git add .github README.md playwright.config.ts e2e
git commit -m "ci: verify and deploy generator to pages"
```

### Task 10: Final visual and acceptance review

**Files:**
- Modify if evidence requires: `src/features/rendering/template.ts`
- Modify if evidence requires: `src/styles.css`
- Modify if evidence requires: corresponding tests

**Interfaces:**
- Consumes: completed application
- Produces: reviewed 1024×768 question/answer pair and clean release gate

- [ ] **Step 1: Generate reference outputs**

Run: `npm run dev`
Use Pikachu default form to export:
- silhouette question;
- crop question after one drag and one zoom;
- answer.

Expected: all downloads are 1024×768 JPEG files and open successfully.

- [ ] **Step 2: Review template alignment**

Confirm:
- no Pokémon pixel overlaps the white/red frame;
- silhouette is centered inside `{ x: 70, y: 75, width: 320, height: 380 }`;
- crop contains visible content and does not reveal more than 70% of opaque pixels;
- answer art is full color and contain-fitted;
- the answer panel covers all original yellow question text;
- Chinese, English, number and form text remain inside the answer region.

If any item fails, change only measured template constants or answer fill, add/update the corresponding render-plan assertion, rerun rendering tests, and regenerate the three outputs.

- [ ] **Step 3: Perform final automated verification**

Run: `npm run check`
Expected: PASS.

Run: `npm run test:e2e`
Expected: PASS.

Run: `git status --short`
Expected: clean, or only reviewed visual-tuning files remain.

- [ ] **Step 4: Commit evidence-based visual tuning if needed**

```bash
git add src/features/rendering/template.ts src/features/rendering/*.test.ts src/styles.css
git commit -m "fix: align generator template output"
```

Skip this commit when Step 2 required no changes.
