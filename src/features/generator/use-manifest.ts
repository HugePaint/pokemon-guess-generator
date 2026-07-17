import { useCallback, useEffect, useState } from "react";
import { loadManifest } from "../../data/load-manifest";
import type { PokemonManifest } from "../../domain/pokemon";

export type ManifestStatus = "loading" | "ready" | "error";

export interface ManifestController {
  readonly status: ManifestStatus;
  readonly manifest: PokemonManifest | null;
  readonly message: string;
  retry(): void;
}

export function useManifest(
  loader: () => Promise<PokemonManifest> = loadManifest,
): ManifestController {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: ManifestStatus;
    manifest: PokemonManifest | null;
    message: string;
  }>({
    status: "loading",
    manifest: null,
    message: "正在加载图鉴数据…",
  });

  useEffect(() => {
    let active = true;
    setState({
      status: "loading",
      manifest: null,
      message: "正在加载图鉴数据…",
    });

    void loader().then(
      (manifest) => {
        if (active) {
          setState({ status: "ready", manifest, message: "" });
        }
      },
      () => {
        if (active) {
          setState({
            status: "error",
            manifest: null,
            message: "图鉴数据加载失败，请重试",
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [attempt, loader]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}
