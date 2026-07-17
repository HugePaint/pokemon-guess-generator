import type { PokemonManifest } from "../domain/pokemon";
import { ControlPanel } from "../components/ControlPanel";
import { LegalNotice } from "../components/LegalNotice";
import { PreviewPanel } from "../components/PreviewPanel";
import {
  useGenerator,
  type GeneratorDependencies,
} from "../features/generator/use-generator";
import { useManifest } from "../features/generator/use-manifest";

export interface AppProps {
  readonly loadManifest?: () => Promise<PokemonManifest>;
  readonly generatorDependencies?: Partial<GeneratorDependencies>;
  readonly templateImage?: HTMLImageElement;
}

export function App({
  loadManifest,
  generatorDependencies,
  templateImage,
}: AppProps = {}) {
  const manifestController = useManifest(loadManifest);

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">WHO'S THAT POKÉMON?</p>
        <h1>宝可梦“我是谁”图片生成器</h1>
        <p>选择宝可梦和题面模式，在浏览器中生成题面与答案图片。</p>
      </header>

      {manifestController.status === "loading" && (
        <section className="panel app-state" role="status" aria-live="polite">
          {manifestController.message}
        </section>
      )}
      {manifestController.status === "error" && (
        <section className="panel app-state" aria-label="图鉴加载错误">
          <p role="status" aria-live="polite">{manifestController.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={manifestController.retry}
          >
            重试加载图鉴
          </button>
        </section>
      )}
      {manifestController.status === "ready"
        && manifestController.manifest !== null && (
          <GeneratorWorkbench
            manifest={manifestController.manifest}
            dependencies={generatorDependencies}
            templateImage={templateImage}
          />
        )}
      <LegalNotice />
    </main>
  );
}

interface GeneratorWorkbenchProps {
  readonly manifest: PokemonManifest;
  readonly dependencies?: Partial<GeneratorDependencies>;
  readonly templateImage?: HTMLImageElement;
}

function GeneratorWorkbench({
  manifest,
  dependencies,
  templateImage,
}: GeneratorWorkbenchProps) {
  const controller = useGenerator(manifest, dependencies);

  return (
    <div className="workspace">
      <ControlPanel controller={controller} />
      <PreviewPanel
        controller={controller}
        {...(templateImage === undefined ? {} : { templateImage })}
      />
    </div>
  );
}
