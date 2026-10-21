import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const source = readFileSync(new URL("../lib/gemini.ts", import.meta.url), "utf8").replace('"./domain"', JSON.stringify(new URL("../lib/domain.ts", import.meta.url).href));
const { suggestWithGemini, validateCandidates } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64"));
const entry = { key: "button", source: "Hello {name}", component: "button", translations: { de: "Guten Tag {name}", fr: "", ko: "" } };
const conditions = { widths: [100, 160], fonts: ["Bench Sans"], fontSize: 14, padding: 12, scenario: "normal", variables: {} };
const answer = value => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
test("Gemini receives context server-side and returns usable variable-safe candidates", async () => {
  const result = await suggestWithGemini(entry, "de", conditions, "test-only", "gemini-3.5-flash-lite", async (url, options) => {
    assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.ok(!url.includes("test-only"));
    assert.equal(options.headers["x-goog-api-key"], "test-only");
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    const context = JSON.parse(body.contents[0].parts[0].text);
    assert.deepEqual(context.widths, [100, 160]);
    assert.equal(context.source, "Hello {name}");
    return answer({ candidates: [{ text: "Hallo {name}", reason: "짧은 인사" }] });
  });
  assert.equal(result.provider, "gemini");
  assert.equal(result.candidates[0].text, "Hallo {name}");
});
test("AI candidates discard duplicate, unchanged, empty and corrupted placeholders", () => {
  assert.deepEqual(validateCandidates({ candidates: [
    { text: "Guten Tag {name}", reason: "unchanged" }, { text: "Hallo", reason: "missing" },
    { text: "Hallo {name} {name}", reason: "duplicate variable" }, { text: "Hallo {person}", reason: "renamed" },
    { text: "Hallo {name}", reason: "valid" }, { text: "Hallo {name}", reason: "duplicate" },
  ] }, entry.source, entry.translations.de), [{ text: "Hallo {name}", reason: "valid" }]);
  assert.throws(() => validateCandidates({ candidates: [{ text: "Hallo", reason: "wrong" }] }, entry.source, entry.translations.de));
});
test("Gemini errors never expose the key or provider response", async () => {
  for (const status of [400, 403, 404, 429, 500]) await assert.rejects(
    () => suggestWithGemini(entry, "de", conditions, "private-test", undefined, async () => Response.json({ key: "private-test" }, { status })),
    error => !error.message.includes("private-test"),
  );
  await assert.rejects(() => suggestWithGemini(entry, "de", conditions, "private-test", undefined, async () => { throw new Error("private-test"); }), error => !error.message.includes("private-test"));
});
test("Gemini rejects truncated output, malformed JSON and variable loss", async () => {
  for (const payload of [
    { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "invalid json" }] } }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ candidates: [{ text: "Hallo", reason: "lost variable" }] }) }] } }] },
  ]) await assert.rejects(() => suggestWithGemini(entry, "de", conditions, "test-only", undefined, async () => Response.json(payload)));
});
