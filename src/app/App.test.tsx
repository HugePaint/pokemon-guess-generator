import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the generator heading and disabled downloads", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "宝可梦“我是谁”图片生成器" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "下载题面" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下载答案" })).toBeDisabled();
  });
});
