"use client";
import { useState, useEffect } from "react";
import { createProject } from "../../lib/samples";
import { measureProject } from "../../lib/measure";
import type { Run } from "../../lib/domain";
export default function Poc() {
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setReady(true));
  }, []);
  return (
    <main style={{ padding: 30 }}>
      <h1>LocaleBench 측정 PoC</h1>
      <button
        disabled={!ready}
        onClick={async () => {
          try {
            setRun(await measureProject(createProject()));
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        180개 측정
      </button>
      <pre data-testid="poc-result">{error || (run ? JSON.stringify(run) : "대기")}</pre>
    </main>
  );
}
