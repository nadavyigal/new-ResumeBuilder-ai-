import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Exclude nested copies of the project and duplicate scripts folder.
      // `.claude/worktrees/` holds live git worktrees checked out INSIDE the
      // repo — 567MB and two more full checkouts as of 2026-08-19. Without
      // this, `next/typescript`'s type-aware rules build a TS program over
      // three copies of the codebase and a lint of eight files takes over
      // half an hour. jest already excludes it (see modulePathIgnorePatterns
      // in jest.config.js); tsconfig and eslint never got the same fix.
      ".claude/worktrees/**",
      "resume-builder-ai/**",
      "scripts/scripts/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default eslintConfig;
