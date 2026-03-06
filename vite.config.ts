import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "HonoOpenwhiskAdapter",
      formats: ["es"],
      fileName: "index",
    },
    sourcemap: true,
    target: "es2022",
    minify: false,
    rollupOptions: {
      external: ["hono"],
      output: {
        globals: { hono: "Hono" },
      },
    },
  },
  plugins: [
    dts({
      outDir: "dist",
      insertTypesEntry: false,
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/types/**", "src/index.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
