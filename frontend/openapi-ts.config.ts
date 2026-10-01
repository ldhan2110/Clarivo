import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:3000/docs-json",
  // types/api, not app/types/api: `@/*` resolves from the frontend root, so
  // `@/types/api` — what every consumer imports — is this directory.
  output: { path: "types/api" },
  // types only — requests go through app/lib/api.ts
  plugins: ["@hey-api/typescript"],
});
