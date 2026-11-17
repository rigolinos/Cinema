import { defineConfig } from "vitest/config";
import path from "path";

// O banco de provas chama a IA de verdade: fica fora do `npm test` e só roda com `npm run provas`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["provas/**/*.prova.ts"], testTimeout: 3_600_000 },
});
