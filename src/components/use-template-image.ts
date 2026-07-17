import { useCallback, useEffect, useState } from "react";
import { loadFirstImage } from "../features/rendering/load-image";
import { TEMPLATE_URL } from "../features/rendering/template";

export interface TemplateImageState {
  readonly image: HTMLImageElement | null;
  readonly hasError: boolean;
  retry(): void;
}

export function useTemplateImage(
  suppliedImage?: HTMLImageElement,
): TemplateImageState {
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(
    suppliedImage ?? null,
  );
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (suppliedImage !== undefined) {
      setLoadedImage(suppliedImage);
      setHasError(false);
      return;
    }

    let active = true;
    setLoadedImage(null);
    setHasError(false);
    void loadFirstImage([TEMPLATE_URL]).then(
      (image) => {
        if (active) {
          setLoadedImage(image);
        }
      },
      () => {
        if (active) {
          setHasError(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, suppliedImage]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    image: suppliedImage ?? loadedImage,
    hasError,
    retry,
  };
}
