export type FailureContext = "crop" | "export" | "preview" | "download";

export function failureMessage(
  error: unknown,
  context: FailureContext,
): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "SecurityError") {
    return "图片受跨域限制，无法读取像素或导出，请选择其他图片";
  }
  if (
    message.includes("浏览器不支持图片像素读取")
    || message.includes("浏览器不支持 Canvas 2D")
  ) {
    return "当前浏览器不支持 Canvas 像素处理";
  }
  if (message.includes("JPG 导出失败")) {
    return "JPEG 编码失败，请重试或更换浏览器";
  }
  if (context === "download" || message.includes("浏览器无法启动下载")) {
    return "浏览器无法启动下载，请检查下载权限后重试";
  }
  if (context === "crop") {
    return "无法生成裁剪，请重试";
  }
  if (context === "preview") {
    return "预览渲染失败，请重试";
  }
  return "导出失败，请重试";
}
