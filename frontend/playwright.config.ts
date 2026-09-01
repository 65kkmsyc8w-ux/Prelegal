import { defineConfig, devices } from "@playwright/test";

// The app is one container: FastAPI serves the API and the built export from a
// single origin, so the suite runs against a running container rather than
// against next dev, which has no backend behind it.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // The print stylesheet is the least portable part of this app, so it is
  // exercised on all three engines. page.pdf is Chromium only; the test that
  // needs it skips elsewhere.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
