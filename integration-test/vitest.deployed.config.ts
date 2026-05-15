import { defineConfig } from "vitest/config";

// Separate vitest config for tests that hit the *deployed* App Builder app
// over the network. Run with: `npm run test:deployed`.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["live/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Network calls can be flaky on cold starts; one retry is reasonable.
    retry: 1,
    // Run sequentially so log output is readable and we don't hammer the runtime.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    disableConsoleIntercept: true,
  },
});
