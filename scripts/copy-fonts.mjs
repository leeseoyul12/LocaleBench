import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
const source = process.argv[2];
if (!source) throw new Error("Provide the extracted fontsource directory.");
mkdirSync("public/fonts", { recursive: true });
let output = "/* Bundled fonts; licenses in public/fonts. No network font dependency. */\n";
for (const [folder, family] of [
  ["noto-sans-kr", "Bench Sans"],
  ["ibm-plex-mono", "Bench Mono"],
]) {
  const root = path.join(source, folder, "package");
  const css = readFileSync(path.join(root, "400.css"), "utf8");
  const blocks = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
  for (let block of blocks) {
    const file = block.match(/url\(['"]?\.\/files\/([^)'"\s]+\.woff2)['"]?\)/)?.[1];
    if (!file) continue;
    copyFileSync(path.join(root, "files", file), path.join("public/fonts", file));
    block = block
      .replace(/font-family:\s*[^;]+;/, `font-family: '${family}';`)
      .replace(/font-display:\s*[^;]+;/, "font-display: block;")
      .replace(/src:[^;]+;/, `src: url('/fonts/${file}') format('woff2');`);
    output += block + "\n";
  }
  copyFileSync(path.join(root, "LICENSE"), path.join("public/fonts", `${folder}-LICENSE.txt`));
}
writeFileSync("app/fonts.css", output);
console.log(`Bundled ${output.match(/@font-face/g)?.length} local font faces.`);
