export const ENGINE_VERSION = "dom-1.0.0";
export const LOCALES = ["de", "fr", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export type Font = "Bench Sans" | "Bench Mono";
export type Component = "button" | "label" | "banner";
export type Entry = {
  key: string;
  source: string;
  translations: Record<Locale, string>;
  component: Component;
};
export type Conditions = {
  widths: number[];
  fonts: Font[];
  fontSize: number;
  padding: number;
  scenario: "normal" | "long";
  variables: Record<string, string>;
};
export type Measurement = {
  id: string;
  key: string;
  locale: Locale;
  component: Component;
  width: number;
  font: Font;
  text: string;
  available: number;
  textWidth: number;
  excess: number;
  overflow: boolean;
  variables: string[];
  error?: string;
  suggestion: number;
};
export type Run = {
  id: string;
  date: string;
  revision: number;
  engine: string;
  conditionHash: string;
  conditions: Conditions;
  snapshot: Entry[];
  measurements: Measurement[];
  duration: number;
  browser: string;
  viewport: string;
  dpr: number;
  status: "completed" | "partial";
};
export type Project = {
  id: string;
  name: string;
  sourceLocale: "en";
  entries: Entry[];
  conditions: Conditions;
  revision: number;
  runs: Run[];
  updatedAt: string;
  origin: "demo" | "manual" | "google";
  reviewed: string[];
};
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// A scanner keeps duplicate keys visible before JSON.parse would discard them.
export function parseFlatJson(raw: string): Record<string, string> {
  if (new TextEncoder().encode(raw).length > 256 * 1024)
    throw new ValidationError("JSON 파일은 256KiB 이하로 넣어 주세요.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError("JSON 형식이 올바르지 않습니다. 따옴표와 쉼표를 확인해 주세요.");
  }
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new ValidationError("문자열 키와 문자열 값으로 된 JSON 객체가 필요합니다.");
  const seen = new Set<string>();
  let i = 0;
  const space = () => {
    while (/\s/.test(raw[i] ?? "") && i < raw.length) i++;
  };
  const readString = () => {
    const start = i++;
    while (i < raw.length) {
      if (raw[i] === "\\") {
        i += 2;
        continue;
      }
      if (raw[i++] === '"') return JSON.parse(raw.slice(start, i)) as string;
    }
    throw new ValidationError("문자열이 닫히지 않았습니다.");
  };
  space();
  i++;
  space();
  while (raw[i] !== "}") {
    const key = readString();
    if (seen.has(key))
      throw new ValidationError(`중복 키 '${key}'가 있습니다. 각 키를 고유하게 바꿔 주세요.`);
    seen.add(key);
    space();
    i++;
    space();
    if (raw[i] !== '"')
      throw new ValidationError(
        `'${key}' 값은 문자열이어야 합니다. 중첩 객체·배열·숫자는 지원하지 않습니다.`,
      );
    readString();
    space();
    if (raw[i] === "}") break;
    i++;
    space();
  }
  if (seen.size > 100) throw new ValidationError("프로젝트당 최대 100개 문자열을 지원합니다.");
  const result: Record<string, string> = Object.create(null);
  for (const [key, text] of Object.entries(value)) {
    if (!key || key.length > 120) throw new ValidationError("키는 1~120자로 넣어 주세요.");
    if (typeof text !== "string") throw new ValidationError(`'${key}' 값은 문자열이어야 합니다.`);
    if ([...text].length > 2000)
      throw new ValidationError(`'${key}' 문자열은 2,000자 이하로 넣어 주세요.`);
    placeholders(text);
    result[key] = text;
  }
  return result;
}

export type Placeholder = { raw: string; start: number; end: number; kind: "named" | "positional" };
export function placeholders(text: string): Placeholder[] {
  const result: Placeholder[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      const end = text.indexOf("}", i);
      const raw = end < 0 ? "" : text.slice(i, end + 1);
      if (!/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(raw))
        throw new ValidationError(
          "단순 {name} 변수만 지원합니다. ICU·중첩 괄호·literal brace는 지원하지 않습니다.",
        );
      result.push({ raw, start: i, end: end + 1, kind: "named" });
      i = end;
    } else if (text[i] === "}") throw new ValidationError("짝이 맞지 않는 중괄호가 있습니다.");
    else if (text[i] === "%") {
      if (text[i + 1] === "%") {
        i++;
        continue;
      }
      if (text[i + 1] === "s") {
        result.push({ raw: "%s", start: i, end: i + 2, kind: "positional" });
        i++;
      } else if (/[%\d$A-Za-z]/.test(text[i + 1] ?? ""))
        throw new ValidationError("percent 변수는 %s 또는 literal %%만 지원합니다.");
    }
  }
  if (result.filter((p) => p.kind === "positional").length > 1)
    throw new ValidationError(
      "%s가 여러 개면 의미 순서를 확인할 수 없습니다. {first}, {second}처럼 이름 있는 변수를 사용해 주세요.",
    );
  return result;
}

export function parity(source: string, translated: string): string[] {
  try {
    const count = (text: string) => {
      const map = new Map<string, number>();
      for (const p of placeholders(text)) map.set(p.raw, (map.get(p.raw) ?? 0) + 1);
      return map;
    };
    const a = count(source),
      b = count(translated);
    return [...new Set([...a.keys(), ...b.keys()])]
      .filter((key) => a.get(key) !== b.get(key))
      .map((key) => `${key}: 원문 ${a.get(key) ?? 0}개 / 번역 ${b.get(key) ?? 0}개`);
  } catch (error) {
    return [error instanceof Error ? error.message : "변수 형식 오류"];
  }
}

export function mask(text: string, nonce: string) {
  let prefix = `LBX${nonce.replace(/[^A-Za-z0-9]/g, "")}X`;
  while (text.includes(prefix)) prefix += "X";
  const tokens = placeholders(text).map((p, i) => ({ ...p, token: `${prefix}${i}Z` }));
  let masked = text;
  for (const token of [...tokens].reverse())
    masked = masked.slice(0, token.start) + token.token + masked.slice(token.end);
  return { masked, tokens, prefix };
}
export function restore(translated: string, protectedText: ReturnType<typeof mask>): string {
  let result = translated;
  for (const token of protectedText.tokens) {
    if (result.split(token.token).length !== 2)
      throw new ValidationError(
        "번역 과정에서 변수 토큰이 손상되었습니다. 수동 번역으로 수정해 주세요.",
      );
    result = result.replace(token.token, token.raw);
  }
  if (result.includes(protectedText.prefix))
    throw new ValidationError("번역 결과에 알 수 없는 변수 토큰이 있습니다.");
  return result;
}
export function simulate(text: string, conditions: Conditions): string {
  const values: Record<string, string> = Object.assign(
    Object.create(null),
    {
      name: conditions.scenario === "long" ? "Alexandria-Montgomery" : "Kim",
      count: conditions.scenario === "long" ? "999,999" : "3",
    },
    conditions.variables,
  );
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}|%s|%%/g, (match, key: string) =>
    match === "%%"
      ? "%"
      : match === "%s"
        ? conditions.scenario === "long"
          ? "Alexandria-Montgomery"
          : "Kim"
        : (values[key] ?? (conditions.scenario === "long" ? "Alexandria-Montgomery" : "Kim")),
  );
}
export function conditionIdentity(project: Pick<Project, "entries" | "conditions">): string {
  return JSON.stringify({
    engine: ENGINE_VERSION,
    conditions: project.conditions,
    components: project.entries
      .map((e) => [e.key, e.component])
      .sort((a, b) => a[0].localeCompare(b[0])),
  });
}
export function compareRuns(current: Run, previous?: Run) {
  if (!previous)
    return { comparable: false, reason: "첫 검사입니다.", added: 0, persistent: 0, resolved: 0 };
  if (
    current.conditionHash !== previous.conditionHash ||
    current.browser !== previous.browser ||
    current.viewport !== previous.viewport ||
    current.dpr !== previous.dpr
  )
    return {
      comparable: false,
      reason: "검사 조건 또는 브라우저 환경이 달라 직접 비교할 수 없습니다.",
      added: 0,
      persistent: 0,
      resolved: 0,
    };
  const failures = (run: Run) =>
    new Set(
      run.measurements.flatMap((m) => [
        ...(m.overflow ? [`${m.id}:overflow`] : []),
        ...(m.variables.length ? [`${m.id}:variables`] : []),
        ...(m.error ? [`${m.id}:measurement`] : []),
      ]),
    );
  const a = failures(current),
    b = failures(previous);
  return {
    comparable: true,
    reason: "동일한 검사 조건",
    added: [...a].filter((x) => !b.has(x)).length,
    persistent: [...a].filter((x) => b.has(x)).length,
    resolved: [...b].filter((x) => !a.has(x)).length,
  };
}
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== "object") throw new ValidationError("프로젝트 데이터가 없습니다.");
  const p = value as Project;
  if (
    typeof p.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(p.id) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 100
  )
    throw new ValidationError("프로젝트 이름 또는 ID가 올바르지 않습니다.");
  if (
    p.sourceLocale !== "en" ||
    !Array.isArray(p.entries) ||
    p.entries.length > 100 ||
    !Number.isInteger(p.revision) ||
    p.revision < 1
  )
    throw new ValidationError("지원하지 않는 프로젝트 형식입니다.");
  const keys = new Set();
  for (const e of p.entries) {
    if (
      !e ||
      typeof e.key !== "string" ||
      !e.key ||
      e.key.length > 120 ||
      keys.has(e.key) ||
      typeof e.source !== "string" ||
      [...e.source].length > 2000 ||
      !["button", "label", "banner"].includes(e.component)
    )
      throw new ValidationError("문자열 또는 컴포넌트가 올바르지 않습니다.");
    keys.add(e.key);
    placeholders(e.source);
    for (const l of LOCALES)
      if (typeof e.translations?.[l] !== "string" || [...e.translations[l]].length > 2000)
        throw new ValidationError("번역문은 2,000자 이하의 문자열이어야 합니다.");
  }
  const c = p.conditions;
  if (
    !c ||
    !Array.isArray(c.widths) ||
    !c.widths.length ||
    c.widths.length > 5 ||
    c.widths.some((w) => !Number.isFinite(w) || w < 40 || w > 1000) ||
    !Array.isArray(c.fonts) ||
    !c.fonts.length ||
    c.fonts.length > 2 ||
    c.fonts.some((f) => !["Bench Sans", "Bench Mono"].includes(f)) ||
    !Number.isFinite(c.fontSize) ||
    c.fontSize < 10 ||
    c.fontSize > 36 ||
    !Number.isFinite(c.padding) ||
    c.padding < 0 ||
    c.padding > 32 ||
    !["normal", "long"].includes(c.scenario)
  )
    throw new ValidationError("검사 조건이 지원 범위 밖입니다.");
  if (
    !c.variables ||
    typeof c.variables !== "object" ||
    Array.isArray(c.variables) ||
    Object.keys(c.variables).length > 100 ||
    Object.entries(c.variables).some(
      ([k, v]) =>
        k.length > 120 || !/^[A-Za-z_]\w*$/.test(k) || typeof v !== "string" || v.length > 100,
    )
  )
    throw new ValidationError("변수 예시 값이 올바르지 않습니다.");
  if (
    !Array.isArray(p.reviewed) ||
    p.reviewed.length > 1000 ||
    p.reviewed.some((v) => typeof v !== "string" || v.length > 300) ||
    !["demo", "manual", "google"].includes(p.origin)
  )
    throw new ValidationError("검토 상태가 올바르지 않습니다.");
  return p;
}

// Historical inputs remain immutable; validate their shape before storing or restoring.
export function validateRun(value: unknown): Run {
  const r = value as Run;
  if (
    !r ||
    typeof r.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(r.id) ||
    typeof r.date !== "string" ||
    !Number.isFinite(Date.parse(r.date)) ||
    !Number.isInteger(r.revision) ||
    r.revision < 1 ||
    r.engine !== ENGINE_VERSION ||
    typeof r.conditionHash !== "string" ||
    r.conditionHash.length > 20000 ||
    typeof r.browser !== "string" ||
    r.browser.length > 1000 ||
    typeof r.viewport !== "string" ||
    r.viewport.length > 50 ||
    !Number.isFinite(r.dpr) ||
    r.dpr <= 0 ||
    !Number.isFinite(r.duration) ||
    r.duration < 0 ||
    !["completed", "partial"].includes(r.status) ||
    !Array.isArray(r.measurements) ||
    r.measurements.length > 3000
  )
    throw new ValidationError("실행 기록 형식이 올바르지 않습니다.");
  validateProject({
    id: r.id,
    name: "실행 스냅샷",
    sourceLocale: "en",
    entries: r.snapshot,
    conditions: r.conditions,
    revision: r.revision,
    origin: "manual",
    reviewed: [],
  });
  const ids = new Set<string>();
  for (const m of r.measurements) {
    if (
      !m ||
      typeof m.id !== "string" ||
      m.id.length > 300 ||
      ids.has(m.id) ||
      typeof m.key !== "string" ||
      m.key.length > 120 ||
      !LOCALES.includes(m.locale) ||
      !["button", "label", "banner"].includes(m.component) ||
      !["Bench Sans", "Bench Mono"].includes(m.font) ||
      typeof m.text !== "string" ||
      [...m.text].length > 100000 ||
      typeof m.overflow !== "boolean" ||
      ![m.width, m.available, m.textWidth, m.excess, m.suggestion].every(
        (n) => Number.isFinite(n) && n >= 0,
      ) ||
      !Array.isArray(m.variables) ||
      m.variables.length > 2000 ||
      m.variables.some((v) => typeof v !== "string" || v.length > 300) ||
      (m.error !== undefined && (typeof m.error !== "string" || m.error.length > 500))
    )
      throw new ValidationError("측정 결과 형식이 올바르지 않습니다.");
    ids.add(m.id);
  }
  return r;
}

export function parseBackup(raw: string): Project {
  if (new TextEncoder().encode(raw).length > 4 * 1024 * 1024)
    throw new ValidationError("프로젝트 백업은 4MiB 이하로 넣어 주세요.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("백업 JSON 형식이 올바르지 않습니다.");
  }
  const p = validateProject(parsed);
  if (
    !Array.isArray(p.runs) ||
    p.runs.length > 20 ||
    typeof p.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(p.updatedAt))
  )
    throw new ValidationError("백업 프로젝트 형식이 올바르지 않습니다.");
  p.runs.forEach(validateRun);
  return p;
}
