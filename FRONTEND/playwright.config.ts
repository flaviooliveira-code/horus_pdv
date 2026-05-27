import { defineConfig, devices } from "@playwright/test";

const appUrl = process.env.SMOKE_APP_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "bash -lc 'Recaptcha__Enabled=false Email__Enabled=false dotnet run --project ../API/NETCORE/HORUSPDV-API.csproj --urls http://localhost:5260'",
      url: "http://localhost:5260/swagger/index.html",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "vite --mode development --host 127.0.0.1 --port 5173",
      url: appUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
