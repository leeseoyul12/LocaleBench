"use client";
import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { measureProject } from "../lib/measure";
import { parity, type Project, type Entry, type Locale, type Measurement } from "../lib/domain";
import type { AiCandidate, AiSuggestion } from "../lib/gemini";

type MeasuredCandidate = AiCandidate & { measurements: Measurement[] };
export default function AiSuggestions({
  project,
  entry,
  locale,
  signedIn,
  connected,
  disabled,
  onApply,
  onSetup,
}: {
  project: Project;
  entry: Entry;
  locale: Locale;
  signedIn: boolean;
  connected: boolean;
  disabled: boolean;
  onApply: (text: string) => Promise<void>;
  onSetup: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiSuggestion | null>(null);
  const [candidates, setCandidates] = useState<MeasuredCandidate[]>([]);
  async function generate() {
    if (loading || disabled) return;
    setError("");
    setLoading(true);
    setCandidates([]);
    setResult(null);
    try {
      const saved = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      if (!saved.ok) {
        const failure = await saved.json() as { error?: string };
        throw new Error(failure.error || "프로젝트 저장에 실패했습니다.");
      }
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, entryKey: entry.key, target: locale }),
      });
      const data = (await response.json()) as AiSuggestion & { error?: string };
      if (!response.ok) throw new Error(data.error || "AI 제안을 받지 못했습니다.");
      if (
        data.provider !== "gemini" ||
        !Array.isArray(data.candidates) ||
        !data.candidates.length ||
        data.candidates.length > 3
      )
        throw new Error("AI 응답 형식이 올바르지 않습니다.");
      const measured: MeasuredCandidate[] = [];
      for (const candidate of data.candidates) {
        if (typeof candidate.text !== "string" || parity(entry.source, candidate.text).length)
          throw new Error("AI 후보의 변수가 원문과 일치하지 않습니다.");
        const candidateProject = structuredClone(project);
        candidateProject.entries = [
          { ...entry, translations: { ...entry.translations, [locale]: candidate.text } },
        ];
        const run = await measureProject(candidateProject);
        measured.push({
          ...candidate,
          measurements: run.measurements.filter((m) => m.locale === locale),
        });
      }
      setCandidates(measured);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 제안을 완료하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="ai-assistant" aria-label="Gemini AI 문구 제안">
      <div className="ai-heading">
        <strong>
          <Sparkles size={17} /> Gemini AI 문구 제안
        </strong>
        <span className="pill">생성형 AI</span>
      </div>
      <p>AI가 짧은 번역 후보를 제안하고, 각 후보를 현재 너비·글꼴 조건으로 실제 검사합니다.</p>
      {!signedIn ? (
        <a className="button" href="/signin-with-chatgpt?return_to=/" target="_top">
          로그인 후 AI 제안 사용
        </a>
      ) : !connected ? (
        <button className="button" onClick={onSetup}>
          Gemini 연결 설정
        </button>
      ) : (
        <button
          className="button ai-generate"
          disabled={
            loading || disabled || !entry.source.trim() || !entry.translations[locale].trim()
          }
          onClick={generate}
        >
          {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {loading ? "AI 후보 생성·너비 검사 중…" : "AI로 짧은 문구 제안"}
        </button>
      )}
      {!entry.translations[locale].trim() && (
        <small>현재 언어의 번역문을 먼저 입력하거나 Google 번역을 실행하세요.</small>
      )}
      {error && (
        <div className="ai-error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="ai-provider">
          실제 Gemini API 응답 · {result.model}
          {result.cached ? " · 저장된 AI 결과" : ""}
        </div>
      )}
      {candidates.map((candidate, i) => {
        const checked = candidate.measurements;
        const pass = checked.filter((m) => !m.error && !m.overflow && !m.variables.length).length;
        const allPass = checked.length > 0 && pass === checked.length;
        const worst = Math.max(0, ...checked.map((m) => m.excess));
        return (
          <article className="ai-candidate" key={candidate.text}>
            <div className="ai-candidate-heading">
              <strong>후보 {i + 1}</strong>
              <span className={`pill ${allPass ? "green" : "amber"}`}>
                {allPass ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {pass}/{checked.length} 조건 통과
              </span>
            </div>
            <div className="ai-candidate-text">{candidate.text}</div>
            <p>{candidate.reason}</p>
            <small>
              {checked.some((m) => m.error)
                ? "일부 조건 측정 실패"
                : allPass
                  ? "현재 검사 조건의 모든 너비에 들어갑니다."
                  : `최대 ${worst.toFixed(2)}px 초과 · 더 짧은 후보를 확인하세요.`}
            </small>
            <details>
              <summary>너비별 실측 결과</summary>
              <ul>
                {checked.map((m) => (
                  <li key={m.id}>
                    {m.width}px · {m.font}:{" "}
                    {m.error ||
                      `글자 ${m.textWidth}px / 내부 ${m.available}px${m.overflow ? " · 넘침" : " · 통과"}`}
                  </li>
                ))}
              </ul>
            </details>
            <button
              className="button"
              disabled={disabled || loading}
              onClick={() => onApply(candidate.text)}
            >
              이 문구 적용 후 재검사
            </button>
          </article>
        );
      })}
      <small>
        후보는 자동 적용하지 않습니다. 짧아지며 의미가 달라질 수 있으니 뜻을 확인한 뒤 선택하세요.
        원문과 번역문은 Google로 전송됩니다.
      </small>
    </section>
  );
}
