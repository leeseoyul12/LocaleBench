import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFlatJson,
  parity,
  mask,
  restore,
  placeholders,
  simulate,
  compareRuns,
  validateProject,
  parseBackup,
} from "../lib/domain.ts";
test("flat JSON retains unicode, escapes and empty strings", () => {
  assert.deepEqual(
    { ...parseFlatJson('{"greet":"안녕 👋","quote":"a\\\"b","empty":""}') },
    { greet: "안녕 👋", quote: 'a"b', empty: "" },
  );
});
test("duplicate keys including escaped aliases are rejected", () => {
  assert.throws(() => parseFlatJson('{"a":"first","\\u0061":"second"}'), /중복/);
});
test("nested, arrays, numbers, null and invalid JSON rejected", () => {
  for (const text of ["[]", "null", '{"a":2}', '{"a":null}', '{"a":{}}', '{"a":[]}', '{"a":'])
    assert.throws(() => parseFlatJson(text));
});
test("limits use Unicode code points", () => {
  assert.equal(parseFlatJson(JSON.stringify({ a: "👋".repeat(2000) })).a.length, 4000);
  assert.throws(() => parseFlatJson(JSON.stringify({ a: "👋".repeat(2001) })));
});
test("named placeholder reorder allowed, multiplicity preserved", () => {
  assert.deepEqual(parity("{first} then {second}", "{second} puis {first}"), []);
  assert.equal(parity("{name} {name}", "{name}").length, 1);
  assert.equal(parity("{name}", "{person}").length, 2);
});
test("percent literals and one positional placeholder", () => {
  assert.equal(placeholders("20%% for %s").length, 1);
  assert.throws(() => placeholders("%s %s"));
  assert.throws(() => placeholders("%d"));
  assert.throws(() => placeholders("{n, plural, one{x}}"));
});
test("mask restoration detects missing, extra, changed and duplicate tokens", () => {
  const m = mask("{name} and {name}", "abc");
  assert.equal(restore(m.masked, m), "{name} and {name}");
  for (const broken of [
    m.masked.replace(m.tokens[0].token, ""),
    m.masked + m.tokens[0].token,
    m.masked.replace("LBX", "L B X"),
    m.masked + " " + m.prefix + "999Z",
  ])
    assert.throws(() => restore(broken, m));
});
test("source token collision handled", () => {
  const m = mask("LBXabcX0Z {name}", "abc");
  assert.equal(restore(m.masked, m), "LBXabcX0Z {name}");
});
test("runtime scenarios and override values", () => {
  const c = { scenario: "normal", variables: {} };
  assert.equal(simulate("Hello {name} %s 20%%", c), "Hello Kim Kim 20%");
  assert.match(simulate("{name}", { ...c, scenario: "long" }), /Montgomery/);
  assert.equal(simulate("{name}", { ...c, variables: { name: "서율" } }), "서율");
});
test("prototype-named variables do not read object prototypes", () => {
  assert.equal(simulate("{constructor}", { scenario: "normal", variables: {} }), "Kim");
});
test("regression separates changed conditions, added, persistent and resolved", () => {
  const base = { conditionHash: "x", browser: "test", viewport: "1×1", dpr: 1 };
  const row = (id, overflow) => ({ id, overflow, variables: [] });
  const a = { ...base, measurements: [row("a", true), row("b", true)] },
    b = { ...base, measurements: [row("a", true), row("c", true)] };
  assert.deepEqual(compareRuns(a, b), {
    comparable: true,
    reason: "동일한 검사 조건",
    added: 1,
    persistent: 1,
    resolved: 1,
  });
  assert.equal(compareRuns({ ...a, conditionHash: "y" }, b).comparable, false);
});
test("project payload validates shared conditions and ownership-independent ID", () => {
  const p = {
    id: "sample",
    name: "Sample",
    sourceLocale: "en",
    entries: [],
    revision: 1,
    conditions: {
      widths: [100],
      fonts: ["Bench Sans"],
      fontSize: 14,
      padding: 12,
      scenario: "normal",
      variables: {},
    },
    reviewed: [],
    origin: "demo",
  };
  assert.equal(validateProject(p), p);
  assert.throws(() => validateProject({ ...p, conditions: { ...p.conditions, widths: [0] } }));
});
test("backup rejects malformed dates and history before rendering", () => {
  const p = {
    id: "sample",
    name: "Sample",
    sourceLocale: "en",
    entries: [],
    revision: 1,
    conditions: {
      widths: [100],
      fonts: ["Bench Sans"],
      fontSize: 14,
      padding: 12,
      scenario: "normal",
      variables: {},
    },
    reviewed: [],
    origin: "demo",
    runs: [],
    updatedAt: new Date().toISOString(),
  };
  assert.equal(parseBackup(JSON.stringify(p)).id, "sample");
  assert.throws(() => parseBackup(JSON.stringify({ ...p, updatedAt: "invalid" })));
  assert.throws(() => parseBackup(JSON.stringify({ ...p, runs: [{ id: "run" }] })));
});
