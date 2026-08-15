import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Der Prod-Container laeuft in UTC. Ohne explizite timeZone rendert
          // eine Server-Komponente den Instant 1-2h zu frueh, und der Browser
          // rendert danach denselben Instant in der Besucher-Zone — was
          // zusaetzlich einen Hydration-Mismatch ausloest.
          selector:
            'CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]:not(:has(ObjectExpression > Property[key.name="timeZone"]))',
          message:
            "toLocaleDateString/TimeString braucht eine explizite timeZone — APP_TIME_ZONE aus @/lib/activity-format (oder bewusst 'UTC' bei reinen Datums-Strings).",
        },
        {
          // postgres.js bindet Parameter in json-Spalten selbst als JSON. Ein
          // bereits fertiger JSON-String wird dabei ein zweites Mal
          // stringifyt, und in der Spalte landet ein JSON-*String* statt
          // eines Arrays — lautlos, bis irgendwo Array.isArray() false wird.
          selector:
            'TaggedTemplateExpression > TemplateLiteral CallExpression[callee.object.name="JSON"][callee.property.name="stringify"]',
          message:
            "JSON.stringify() in einem SQL-Template doppelt-kodiert json-Spalten. sql.json(wert) verwenden (oder ueber Drizzle schreiben).",
        },
      ],
    },
  },
]);

export default eslintConfig;
