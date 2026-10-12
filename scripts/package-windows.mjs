// Native Windows fallback for the Sites Bash packager. Reuses its build validator.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
const [validator, output] = process.argv.slice(2);
if (!validator || !output)
  throw new Error("Usage: node scripts/package-windows.mjs PREPARE_SITE_BUILD_CJS ARCHIVE_PATH");
const root = process.cwd(),
  outputs = path.join(root, "outputs");
mkdirSync(outputs, { recursive: true });
const stage = mkdtempSync(path.join(outputs, "package-"));
const inside = path.relative(outputs, stage);
if (!inside || inside.startsWith("..") || path.isAbsolute(inside))
  throw new Error("Invalid staging path");
try {
  const dist = path.join(stage, "dist");
  const kind = execFileSync(process.execPath, [path.resolve(validator), root, dist], {
    encoding: "utf8",
  }).trim();
  if (kind !== "worker") throw new Error("This fallback packages Worker builds only");
  const source = JSON.parse(readFileSync(path.join(root, ".openai/hosting.json"), "utf8"));
  const builtPath = path.join(root, "dist/.openai/hosting.json");
  const built = existsSync(builtPath) ? JSON.parse(readFileSync(builtPath, "utf8")) : {};
  if (
    source.artifact_metadata &&
    built.artifact_metadata &&
    !isDeepStrictEqual(source.artifact_metadata, built.artifact_metadata)
  )
    throw new Error("Conflicting artifact metadata");
  const hosting = { ...source };
  if (built.artifact_metadata) hosting.artifact_metadata = built.artifact_metadata;
  mkdirSync(path.join(dist, ".openai"), { recursive: true });
  writeFileSync(path.join(dist, ".openai/hosting.json"), JSON.stringify(hosting, null, 2) + "\n");
  if (existsSync(path.join(root, "drizzle")))
    cpSync(path.join(root, "drizzle"), path.join(dist, ".openai/drizzle"), { recursive: true });
  const archive = path.resolve(output);
  mkdirSync(path.dirname(archive), { recursive: true });
  execFileSync("tar.exe", ["-C", stage, "-czf", archive, "dist"], { stdio: "inherit" });
  const entries = execFileSync("tar.exe", ["-tzf", archive], { encoding: "utf8" }).split(/\r?\n/);
  if (!entries.includes("dist/.openai/hosting.json") || !entries.includes("dist/server/index.js"))
    throw new Error("Archive is incomplete");
  console.log(JSON.stringify({ archive, entries: entries.length }));
} finally {
  rmSync(stage, { recursive: true, force: true });
}
