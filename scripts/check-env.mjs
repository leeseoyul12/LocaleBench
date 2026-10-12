import { existsSync, readFileSync } from "node:fs";
const hosting = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
let configured = Boolean(process.env.GOOGLE_TRANSLATION_API_KEY);
for (const file of [".env.local", ".dev.vars"])
  if (existsSync(file))
    configured ||= /^GOOGLE_TRANSLATION_API_KEY\s*=\s*[^\s#]+/m.test(readFileSync(file, "utf8"));
console.log(`DB binding: ${hosting.d1 === "DB" ? "ready" : "missing"}`);
console.log(`Site project: ${hosting.project_id ? "configured" : "missing"}`);
console.log(
  `Google translation key: ${configured ? "configured (value hidden)" : "optional, not configured"}`,
);
console.log("Demo, manual translation and browser measurement work without a Google key.");
