import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:3000/docs-json",
  output: { path: "app/types/api" },
  // types only — requests go through app/lib/api.ts
  plugins: ["@hey-api/typescript"],
});
