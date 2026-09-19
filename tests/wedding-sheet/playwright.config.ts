import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", fullyParallel: true, workers: 2,
  reporter: "list", outputDir: "/tmp/yushef-wedding-sheet-results",
  use: { baseURL: "http://127.0.0.1:3107", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } }
  ],
  webServer: { command: "node tests/wedding-sheet/server.mjs", cwd: process.cwd(), url: "http://127.0.0.1:3107", reuseExistingServer: false }
});
