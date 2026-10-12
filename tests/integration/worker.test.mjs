import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createProject } from "../../lib/samples.ts";

// Execute the built Worker directly. Identity fixtures emulate the trusted gateway.
// This does not test the external ChatGPT login or bypass hosted authentication.
test("built Worker: D1 owner isolation, immutable history, origins, limits and missing key", async () => {
  const root = path.resolve("dist/server");
  const modules = readdirSync(root, { recursive: true }).filter(
    (f) => /\.m?js$/.test(f) && f !== "index.js",
  );
  const mf = new Miniflare({
    modules: [
      { type: "ESModule", path: path.join(root, "index.js") },
      ...modules.map((f) => ({ type: "ESModule", path: path.join(root, f) })),
    ],
    modulesRoot: root,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
  });
  const origin = "http://127.0.0.1:5174";
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const call = (user, method = "GET", url = "/api/projects", data, extra = {}) =>
    mf.dispatchFetch(origin + url, {
      method,
      headers: {
        origin,
        "Content-Type": "application/json",
        ...(user
          ? {
              "oai-authenticated-user-id": user,
              "oai-authenticated-user-email": `${user}@local.test`,
            }
          : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  try {
    const db = await mf.getD1Database("DB");
    const sql = readFileSync("drizzle/0000_clever_devos.sql", "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch(sql.map((s) => db.prepare(s)));
    const p = createProject("API isolation");
    const run = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      revision: 1,
      engine: "dom-1.0.0",
      conditionHash: "fixture",
      conditions: p.conditions,
      snapshot: p.entries,
      measurements: [],
      duration: 1,
      browser: "test",
      viewport: "1440×1000",
      dpr: 1,
      status: "completed",
    };
    p.runs = [run];
    assert.equal((await call()).status, 401);
    assert.deepEqual(await (await call(undefined, "GET", "/api/status")).json(), {
      signedIn: false,
      cloud: false,
      google: false,
    });
    assert.equal((await call(a, "POST", "/api/projects", p)).status, 200);
    let list = (await (await call(a)).json()).projects;
    assert.equal(list[0].id, p.id);
    assert.equal(list[0].runs[0].duration, 1);
    assert.equal(
      (await call(a, "POST", "/api/projects", { ...p, runs: [{ ...run, duration: 999 }] })).status,
      200,
    );
    list = (await (await call(a)).json()).projects;
    assert.equal(list[0].runs[0].duration, 1);
    assert.equal((await (await call(b)).json()).projects.length, 0);
    assert.equal((await call(b, "POST", "/api/projects", p)).status, 403);
    assert.equal((await call(b, "DELETE", "/api/projects/" + p.id, {})).status, 404);
    assert.equal(
      (await call(b, "POST", "/api/projects", { ...p, id: crypto.randomUUID() })).status,
      403,
    );
    assert.equal(
      (await call(a, "POST", "/api/projects", p, { origin: "https://other.example" })).status,
      403,
    );
    assert.equal(
      (
        await call(a, "POST", "/api/projects", {
          ...p,
          runs: [{ ...run, measurements: [{ id: "invalid" }] }],
        })
      ).status,
      400,
    );
    assert.equal(
      (await call(a, "POST", "/api/projects", "x".repeat(4 * 1024 * 1024 + 1))).status,
      413,
    );
    assert.equal(
      (
        await call(a, "POST", "/api/translate", {
          projectId: p.id,
          target: "de",
          requestId: crypto.randomUUID(),
        })
      ).status,
      503,
    );
    assert.equal((await call(a, "DELETE", "/api/projects/" + p.id, {})).status, 200);
    assert.equal((await (await call(a)).json()).projects.length, 0);
  } finally {
    await mf.dispose();
  }
});
