import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Shared rules for every TypeScript package in the repo. */
export default tseslint.config(
  { ignores: ["dist/**", ".next/**", "drizzle/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
);
