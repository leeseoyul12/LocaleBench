import test from "node:test";
import assert from "node:assert/strict";
// The provider's imports are rewritten by the test harness, without network access.
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../lib/google.ts", import.meta.url), "utf8").replace(
  '"./domain"',
  JSON.stringify(new URL("../lib/domain.ts", import.meta.url).href),
);
const { stripTypeScriptTypes } = await import("node:module");
const { googleTranslate } = await import(
  "data:text/javascript;base64," +
    Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64")
);
test("Google masks, restores and uses server header", async () => {
  const mock = async (url, options) => {
    assert.equal(url, "https://translation.googleapis.com/language/translate/v2");
    assert.equal(options.headers["X-Goog-Api-Key"], "test-only");
    const body = JSON.parse(options.body);
    assert.equal(body.format, "text");
    assert.ok(!body.q[0].includes("{name}"));
    return Response.json({
      data: {
        translations: body.q.map((text) => ({ translatedText: text.replace("Hello", "Hallo") })),
      },
    });
  };
  assert.deepEqual(await googleTranslate(["Hello {name}", "Hello %s"], "de", "test-only", mock), [
    "Hallo {name}",
    "Hallo %s",
  ]);
});
test("Google rejects malformed responses and broken tokens", async () => {
  for (const payload of [
    {},
    { data: { translations: [] } },
    { data: { translations: [{ translatedText: "broken" }] } },
  ])
    await assert.rejects(() =>
      googleTranslate(["Hello {name}"], "de", "test-only", async () => Response.json(payload)),
    );
});
test("Google rejects authorization, quota and service errors without echoing keys", async () => {
  for (const status of [403, 429, 500])
    await assert.rejects(
      () =>
        googleTranslate(["Hello"], "de", "secret-test", async () =>
          Response.json({ secret: "secret-test" }, { status }),
        ),
      (error) => !error.message.includes("secret-test"),
    );
});
