import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".wrangler", "node_modules", "src/worker/worker-configuration.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Tenant isolation: only src/worker/db/ may talk to D1 directly. Everything else goes
    // through createTenantDb() (or the few store lookups exported from db/index.ts).
    files: ["src/worker/**/*.ts"],
    ignores: ["src/worker/db/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^(prepare|batch|exec|withSession)$/]",
          message: "Query the database through src/worker/db (createTenantDb), not directly.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/*"],
              message: "Import from the db module's index, not its internal files.",
            },
          ],
        },
      ],
    },
  },
);
