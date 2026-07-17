export type ImageFactory = () => HTMLImageElement;

export async function loadFirstImage(
  candidates: readonly string[],
  createImage: ImageFactory = () => new Image(),
): Promise<HTMLImageElement> {
  const failedUrls: string[] = [];

  for (const url of candidates) {
    try {
      return await loadImage(url, createImage);
    } catch {
      failedUrls.push(url);
    }
  }

  throw new Error("所有图片候选均加载失败", { cause: failedUrls });
}

function loadImage(url: string, createImage: ImageFactory): Promise<HTMLImageElement> {
  const image = createImage();
  image.crossOrigin = "anonymous";

  if (typeof image.decode === "function") {
    image.src = url;
    return image.decode().then(() => image);
  }

  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败: ${url}`));
    image.src = url;
  });
}
