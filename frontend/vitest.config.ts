import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (`npm test`): plain logic in lib/ and hooks/, run in Node. A test
// that needs a DOM opts in with a `// @vitest-environment` comment.
export default defineConfig({
  resolve: {
    // Same as the "@/*" path in tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
