import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-dist",
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4174 --base=/pokemon-guess-generator/",
    url: "http://127.0.0.1:4174/pokemon-guess-generator/",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:4174/pokemon-guess-generator/",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
