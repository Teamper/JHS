import { defineConfig } from "@playwright/test";

const channel = process.env.CI ? undefined : process.env.JHS_BROWSER_CHANNEL || "msedge";
const viewports = [
  ["desktop-wide", 1440, 900, false],
  ["desktop-regular", 1280, 720, false],
  ["tablet", 820, 1180, true],
  ["mobile", 390, 844, true],
  ["mobile-small", 360, 640, true],
  ["mobile-landscape", 844, 390, true]
];

export default defineConfig({
  testDir: "./specs",
  outputDir: "../../output/playwright/test-results",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["line"], ["html", { outputFolder: "../../output/playwright/report", open: "never" }]],
  use: {
    channel,
    headless: true,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: viewports.map(([name, width, height, touch]) => ({
    name,
    use: { viewport: { width, height }, hasTouch: touch, isMobile: touch }
  }))
});
