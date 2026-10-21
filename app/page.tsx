"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Braces,
  Plus,
  ChevronRight,
  LayoutGrid,
  ScanLine,
  History,
  Settings2,
  Languages,
  Upload,
  Download,
  Search,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Laptop,
  FileJson,
  Copy,
  RotateCcw,
  Play,
  Trash2,
  Menu,
  Loader2,
  Info,
  ArrowUpRight,
} from "lucide-react";
import {
  LOCALES,
  ENGINE_VERSION,
  compareRuns,
  parity,
  parseFlatJson,
  parseBackup,
  simulate,
  type Project,
  type Entry,
  type Locale,
  type Font,
  type Measurement,
} from "../lib/domain";
import { createProject } from "../lib/samples";
import { measureProject } from "../lib/measure";
import { listLocal, saveLocal, deleteLocal } from "../lib/local-store";
import AiSuggestions from "../components/ai-suggestions";
type View = "workspace" | "matrix" | "results" | "history" | "settings";
type Status = {
  signedIn: boolean;
  cloud: boolean;
  google: boolean;
  gemini?: boolean;
  name?: string;
  used?: number;
};
type Modal = "new" | "import" | "delete" | "export" | "restore" | null;
const language: Record<Locale, string> = { de: "독일어", fr: "프랑스어", ko: "한국어" };
const componentName = { button: "버튼", label: "라벨", banner: "한줄 배너" };
const nav = [
  { id: "workspace", name: "문자열 작업공간", icon: Braces },
  { id: "matrix", name: "검사 매트릭스", icon: LayoutGrid },
  { id: "results", name: "검사 결과", icon: ScanLine },
  { id: "history", name: "실행 이력", icon: History },
] as const;
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || "요청을 완료하지 못했습니다.");
  return data;
}
function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function date(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
function failed(m: Measurement) {
  return !!(m.overflow || m.variables.length || m.error);
}
function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]),
    [active, setActive] = useState("");
  const [ready, setReady] = useState(false),
    [status, setStatus] = useState<Status>({ signedIn: false, cloud: false, google: false });
  const [view, setView] = useState<View>("workspace"),
    [locale, setLocale] = useState<Locale>("de"),
    [selected, setSelected] = useState("checkout.buy");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(""),
    [saved, setSaved] = useState("저장 준비"),
    [cloudRevision, setCloudRevision] = useState<Record<string, string>>({});
  const [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [json, setJson] = useState(""),
    [name, setName] = useState("");
  const [menu, setMenu] = useState(false),
    [historyId, setHistoryId] = useState(""),
    [font, setFont] = useState<Font>("Bench Sans");
  const loaded = useRef(false),
    file = useRef<HTMLInputElement>(null);
  const project = projects.find((p) => p.id === active),
    entry = project?.entries.find((e) => e.key === selected) ?? project?.entries[0];
  const latest = project?.runs[0],
    fresh = latest?.revision === project?.revision,
    rows = latest?.measurements ?? [],
    issues = rows.filter(failed);
  const overflow = rows.filter((m) => m.overflow),
    variableIssues = new Set(
      rows.filter((m) => m.variables.length).map((m) => `${m.key}:${m.locale}`),
    );
  const activeRun = project?.runs.find((r) => r.id === historyId) ?? latest;
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      let list: Project[] = [];
      try {
        list = await listLocal();
      } catch (e) {
        setError(message(e));
      }
      try {
        const s = await api<Status>("/api/status");
        setStatus(s);
        if (s.cloud) {
          const remote = await api<{ projects: Project[] }>("/api/projects");
          setCloudRevision(Object.fromEntries(remote.projects.map((p) => [p.id, p.updatedAt])));
          const all = new Map(remote.projects.map((p) => [p.id, p]));
          for (const local of list) {
            const cloud = all.get(local.id);
            if (!cloud || local.updatedAt > cloud.updatedAt) all.set(local.id, local);
          }
          list = [...all.values()];
        }
      } catch {
        /* local mode is independent of cloud availability */
      }
      if (!list.length) list = [createProject()];
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setProjects(list);
      setActive(list[0].id);
      setSelected(list[0].entries[0]?.key ?? "");
      setReady(true);
    })();
  }, []);
  useEffect(() => {
    if (!ready || !project) return;
    const t = setTimeout(() => {
      setSaved("저장 중…");
      saveLocal(project)
        .then(() => setSaved("이 기기에 저장됨"))
        .catch(() => {
          setSaved("저장 실패");
          setError("로컬 저장에 실패했습니다. 저장 공간을 확인하고 프로젝트를 내보내 주세요.");
        });
    }, 250);
    return () => clearTimeout(t);
  }, [project, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement as HTMLElement;
    const selectors =
      "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]";
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(selectors) ?? []).filter(
        (e) => e.offsetParent !== null,
      );
    queueMicrotask(() => focusable()[0]?.focus());
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setError("");
      }
      if (e.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal, busy]);
  function update(fn: (p: Project) => Project, revision = true) {
    setProjects((all) =>
      all.map((p) =>
        p.id === active
          ? {
              ...fn(p),
              revision: p.revision + (revision ? 1 : 0),
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
    setError("");
  }
  function edit(patch: Partial<Entry>) {
    if (entry)
      update((p) => ({
        ...p,
        entries: p.entries.map((e) => (e.key === entry.key ? { ...e, ...patch } : e)),
      }));
  }
  function switchProject(p: Project) {
    setActive(p.id);
    setSelected(p.entries[0]?.key ?? "");
    setHistoryId("");
    setView("workspace");
    setSearch("");
    setFilter("all");
    setMenu(false);
    setError("");
  }
  async function sync(p = project) {
    if (!p || !status.cloud) throw new Error("클라우드 저장에는 로그인이 필요합니다.");
    await api("/api/projects", "POST", p);
    setCloudRevision((v) => ({ ...v, [p.id]: p.updatedAt }));
  }
  async function saveCloud() {
    setBusy("저장 중");
    try {
      await sync();
      setToast("프로젝트와 실행 이력을 클라우드에 저장했습니다.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  async function run() {
    if (!project || busy) return;
    if (!project.entries.length) {
      setJson('{"hello":"Hello, {name}"}');
      setModal("import");
      return;
    }
    setBusy("UI 검사 중");
    setError("");
    try {
      const snapshot = structuredClone(project);
      const result = await measureProject(snapshot);
      const next = {
        ...snapshot,
        runs: [result, ...snapshot.runs].slice(0, 20),
        updatedAt: new Date().toISOString(),
      };
      setProjects((all) =>
        all.map((p) =>
          p.id === snapshot.id
            ? { ...p, runs: [result, ...p.runs].slice(0, 20), updatedAt: next.updatedAt }
            : p,
        ),
      );
      setHistoryId("");
      await saveLocal(next);
      if (status.cloud) {
        try {
          await sync(next);
        } catch (e) {
          setError(`검사는 완료했지만 클라우드 저장에 실패했습니다: ${message(e)}`);
        }
      }
      setToast(`${result.measurements.length}개 조건을 실제 브라우저에서 검사했습니다.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  async function applyAiSuggestion(text: string) {
    if (!project || !entry || busy) return;
    setBusy("AI 후보 적용·검사 중");
    setError("");
    try {
      const next = structuredClone(project);
      const target = next.entries.find((e) => e.key === entry.key)!;
      if (parity(target.source, text).length) throw new Error("AI 후보의 변수가 원문과 다릅니다.");
      target.translations[locale] = text;
      next.revision += 1;
      const run = await measureProject(next);
      next.runs = [run, ...next.runs].slice(0, 20);
      next.updatedAt = new Date().toISOString();
      setProjects((all) =>
        all.map((p) => (p.id === project.id && p.revision === project.revision ? next : p)),
      );
      setHistoryId("");
      await saveLocal(next);
      if (status.cloud) await sync(next);
      setToast(
        "AI 후보를 적용하고 실제 UI 검사를 완료했습니다. 실행 이력에서 이전 결과와 비교하세요.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  async function translate() {
    if (!project || busy) return;
    if (!status.google) {
      setView("settings");
      setToast("Google 키를 연결하거나 번역문을 직접 입력해 주세요.");
      return;
    }
    setBusy("Google 번역 중");
    try {
      const snapshot = structuredClone(project);
      await sync(snapshot);
      const result = await api<{ translations: string[]; keys: string[]; cached?: boolean }>(
        "/api/translate",
        "POST",
        { projectId: project.id, target: locale, requestId: crypto.randomUUID() },
      );
      if (result.keys.join("\0") !== snapshot.entries.map((e) => e.key).join("\0"))
        throw new Error("번역 중 프로젝트가 바뀌었습니다. 다시 시도해 주세요.");
      setProjects((all) =>
        all.map((p) =>
          p.id === snapshot.id && p.revision === snapshot.revision
            ? {
                ...p,
                origin: "google",
                revision: p.revision + 1,
                updatedAt: new Date().toISOString(),
                entries: p.entries.map((e, i) => ({
                  ...e,
                  translations: { ...e.translations, [locale]: result.translations[i] },
                })),
              }
            : p,
        ),
      );
      setToast(
        result.cached
          ? "저장된 Google 번역을 사용했습니다."
          : "Google 번역 완료. UI 검사로 실제 너비를 확인하세요.",
      );
      setStatus(await api<Status>("/api/status"));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  function importJson() {
    try {
      const input = parseFlatJson(json);
      update((p) => ({
        ...p,
        origin: "manual",
        entries: Object.entries(input).map(
          ([key, source]) =>
            p.entries.find((e) => e.key === key && e.source === source) ?? {
              key,
              source,
              component: "button",
              translations: { de: "", fr: "", ko: "" },
            },
        ),
      }));
      setSelected(Object.keys(input)[0] ?? "");
      setModal(null);
      setToast(`${Object.keys(input).length}개 문자열을 가져왔습니다.`);
    } catch (e) {
      setError(message(e));
    }
  }
  function restoreBackup() {
    try {
      const backup = parseBackup(json);
      const p = {
        ...backup,
        id: crypto.randomUUID(),
        name: backup.name.slice(0, 90) + " (복원)",
        runs: backup.runs.map((r) => ({ ...r, id: crypto.randomUUID() })),
        updatedAt: new Date().toISOString(),
      };
      setProjects((all) => [p, ...all]);
      switchProject(p);
      setModal(null);
      setToast("백업을 새 프로젝트로 복원했습니다.");
    } catch (e) {
      setError(message(e));
    }
  }
  function add(demo = false) {
    const p = createProject(name.trim() || (demo ? "Checkout · 다국어 QA" : "새 프로젝트"), demo);
    setProjects((all) => [p, ...all]);
    switchProject(p);
    setName("");
    setModal(null);
  }
  async function remove() {
    if (!project) return;
    setBusy("삭제 중");
    try {
      if (status.cloud && cloudRevision[project.id])
        await api(`/api/projects/${project.id}`, "DELETE", {});
      await deleteLocal(project.id);
      const list = projects.filter((p) => p.id !== project.id);
      if (!list.length) list.push(createProject("새 프로젝트", false));
      setProjects(list);
      switchProject(list[0]);
      setModal(null);
      setToast("프로젝트와 실행 이력을 삭제했습니다.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  function exportTranslation() {
    if (!project) return;
    if (
      project.entries.some(
        (e) =>
          parity(e.source, e.translations[locale]).length || (e.source && !e.translations[locale]),
      )
    ) {
      setError("변수 오류 또는 빈 번역문이 있습니다. 수정 후 내보내 주세요.");
      return;
    }
    download(
      `${project.name}-${locale}.json`,
      Object.fromEntries(project.entries.map((e) => [e.key, e.translations[locale]])),
    );
    setToast("번역 JSON을 내보냈습니다.");
  }
  const visible =
    project?.entries.filter(
      (e) =>
        (e.key + e.source + e.translations[locale]).toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "variables"
            ? parity(e.source, e.translations[locale]).length > 0
            : rows.some((m) => m.key === e.key && m.locale === locale && m.overflow))),
    ) ?? [];
  const selectedRows = rows.filter((m) => m.key === entry?.key && m.locale === locale),
    comparison = latest ? compareRuns(latest, project?.runs[1]) : undefined;
  if (!ready || !project)
    return (
      <main className="boot">
        <span className="brand-mark">
          <Braces size={28} />
        </span>
        <h1>LocaleBench — 다국어 번역 UI 검사</h1>
        <p style={{ maxWidth: "36rem", padding: "0 24px", textAlign: "center" }}>
          독일어·프랑스어·한국어 번역문을 여러 폰트와 너비에서 검사하고, 실제 브라우저 측정으로 UI
          넘침과 변수 오류를 찾아 수정 전후를 비교하세요.
        </p>
        <p>
          <Loader2 className="spin" size={15} /> 작업공간을 불러오는 중입니다
        </p>
        <noscript>문자열 가져오기와 UI 검사를 사용하려면 JavaScript를 켜 주세요.</noscript>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" href="/" aria-label="LocaleBench 홈">
          <span className="brand-mark">
            <Braces size={23} />
          </span>
          <strong>
            Locale<span>Bench</span>
          </strong>
          <span className="beta">BETA</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">L</span>
          <span>
            내 작업공간<small>Localization studio</small>
          </span>
        </div>
        <div className="sidebar-heading">WORKSPACE</div>
        <nav aria-label="작업공간 메뉴">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => {
                setView(n.id);
                setMenu(false);
              }}
            >
              <n.icon size={18} />
              {n.name}
              {n.id === "results" && latest && <span className="nav-count">{issues.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-heading project-heading">
          PROJECTS
          <button aria-label="새 프로젝트" className="icon-button" onClick={() => setModal("new")}>
            <Plus size={15} />
          </button>
        </div>
        <div className="project-list">
          {projects.map((p) => (
            <button
              className={`project-item ${p.id === active ? "current" : ""}`}
              key={p.id}
              onClick={() => switchProject(p)}
            >
              <span className="project-dot" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <button className="add-project" onClick={() => setModal("new")}>
          <Plus size={15} /> 프로젝트 만들기
        </button>
        <div className="sidebar-bottom">
          <div className="helper-card">
            <Languages size={21} />
            <strong>번역 다음은, UI 검사.</strong>
            <p>
              문자 수 대신 실제 화면의
              <br />
              너비를 확인하세요.
            </p>
            <button
              onClick={() => {
                const p = createProject();
                setProjects((all) => [p, ...all]);
                switchProject(p);
              }}
            >
              샘플 프로젝트 열기 <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => {
              setView("settings");
              setMenu(false);
            }}
          >
            <Settings2 size={18} /> 연결 및 설정
          </button>
          <div className="account">
            <span className="avatar">L</span>
            <div>
              <strong>{status.name || "로컬 작업공간"}</strong>
              <small>{status.cloud ? "클라우드 저장 연결됨" : "이 브라우저에 저장"}</small>
            </div>
            <span className={`dot ${status.cloud ? "green" : ""}`} />
          </div>
        </div>
      </aside>
      {menu && (
        <button className="menu-backdrop" aria-label="메뉴 닫기" onClick={() => setMenu(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>프로젝트</span>
            <ChevronRight size={14} />
            <strong>{project.name}</strong>
          </div>
          <div className="topbar-right">
            <span className="save-indicator">
              <Check size={13} />
              {saved}
            </span>
            <button
              className="button quiet small"
              disabled={!!busy || !status.cloud}
              onClick={saveCloud}
            >
              <Cloud size={15} />
              {cloudRevision[project.id] === project.updatedAt
                ? "클라우드 저장됨"
                : "클라우드 저장"}
            </button>
            <span className="avatar">L</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LOCALIZATION QUALITY WORKSPACE</div>
              <h1>
                {view === "settings" ? "연결 및 설정" : nav.find((n) => n.id === view)?.name}
                <span className="project-tag">{project.entries.length} strings</span>
              </h1>
              <p>
                {view === "history"
                  ? "수정 전후를 같은 조건에서 비교하고, 회귀 오류를 확인하세요."
                  : view === "settings"
                    ? "검사 조건과 저장·번역 연결 상태를 확인하세요."
                    : "번역문이 화면에 잘 맞는지, 변수가 안전한지 한곳에서 확인하세요."}
              </p>
            </div>
            <div className="page-actions">
              <button
                className="button"
                onClick={() => {
                  setError("");
                  setModal("export");
                }}
              >
                <Download size={16} /> 내보내기
              </button>
              <button className="button primary" disabled={!!busy} onClick={run}>
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                {busy || "UI 검사 실행"}
              </button>
            </div>
          </div>
          {error && (
            <div className="alert" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="오류 안내 닫기"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="mode-banner">
            <div>
              <span className="dot" />
              <strong>
                {project.origin === "demo"
                  ? "샘플 번역 데이터"
                  : project.origin === "google"
                    ? "Google 번역 데이터"
                    : "직접 입력한 번역"}
              </strong>
              <span>
                {project.origin === "demo"
                  ? "직접 작성한 데모 번역으로 실제 DOM 검사를 실행합니다."
                  : "지원하는 fixture 조건에 한정해 검사합니다."}
              </span>
            </div>
            <button onClick={() => setView("settings")}>
              {status.google ? "Google 연결됨" : "Google 연결 준비"}
              <ArrowUpRight size={14} />
            </button>
          </div>
          {view !== "settings" && (
            <div className="stats-grid">
              <Stat
                icon={FileJson}
                label="검사할 문자열"
                value={String(project.entries.length)}
                detail="영어 원본 · 3개 대상 언어"
              />
              <Stat
                icon={LayoutGrid}
                label="검사 조건"
                value={String(
                  project.entries.length *
                    3 *
                    project.conditions.widths.length *
                    project.conditions.fonts.length,
                )}
                detail={`${project.conditions.widths.length}개 너비 × ${project.conditions.fonts.length}개 폰트`}
              />
              <Stat
                icon={AlertTriangle}
                label="넘침 발견"
                value={latest ? String(overflow.length) : "—"}
                detail={
                  latest
                    ? `${fresh ? "최근 검사" : "수정 전 검사"} · 실제 DOM 측정`
                    : "첫 검사를 실행해 주세요"
                }
                color="amber"
              />
              <Stat
                icon={Braces}
                label="변수 오류"
                value={latest ? String(variableIssues.size) : "—"}
                detail="문자열·언어별 무결성 검사"
                color={variableIssues.size ? "red" : "green"}
              />
            </div>
          )}
          {(view === "workspace" || view === "matrix") && (
            <>
              <div className="work-toolbar">
                <div className="segmented">
                  {LOCALES.map((l) => (
                    <button
                      className={l === locale ? "selected" : ""}
                      key={l}
                      onClick={() => setLocale(l)}
                    >
                      <code>{l.toUpperCase()}</code>
                      {language[l]}
                    </button>
                  ))}
                </div>
                <div className="toolbar-actions">
                  <button
                    className="button quiet"
                    onClick={() => {
                      if (busy) return;
                      setJson(
                        JSON.stringify(
                          Object.fromEntries(project.entries.map((e) => [e.key, e.source])),
                          null,
                          2,
                        ),
                      );
                      setError("");
                      setModal("import");
                    }}
                  >
                    <Upload size={15} /> JSON 가져오기
                  </button>
                  <button className="button" disabled={!!busy} onClick={translate}>
                    <Languages size={16} /> Google 번역
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
              {view === "workspace" ? (
                <div className="workspace-grid">
                  <section className="panel">
                    <div className="panel-header">
                      <h2>
                        UI 문자열 <span>{project.entries.length}</span>
                      </h2>
                      <small>원본 → {locale.toUpperCase()}</small>
                    </div>
                    <div className="list-controls">
                      <label className="search-input">
                        <Search size={15} />
                        <input
                          aria-label="문자열 검색"
                          placeholder="키 또는 문구 검색…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="문자열 필터"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">전체 상태</option>
                        <option value="overflow">넘침</option>
                        <option value="variables">변수 오류</option>
                      </select>
                    </div>
                    <div className="string-table">
                      <div className="table-caption">
                        <span>KEY / SOURCE</span>
                        <span>상태</span>
                      </div>
                      {visible.map((e) => {
                        const bad = rows.some(
                          (m) => m.key === e.key && m.locale === locale && failed(m),
                        );
                        return (
                          <button
                            className={`string-row ${entry?.key === e.key ? "selected" : ""}`}
                            key={e.key}
                            onClick={() => setSelected(e.key)}
                          >
                            <div>
                              <code>{e.key}</code>
                              <span>{e.source || "(빈 문자열)"}</span>
                            </div>
                            <span
                              className={`pill ${parity(e.source, e.translations[locale]).length ? "red" : latest ? (bad ? "amber" : "green") : "neutral"}`}
                            >
                              {parity(e.source, e.translations[locale]).length
                                ? "변수 오류"
                                : latest
                                  ? bad
                                    ? "확인 필요"
                                    : "정상"
                                  : "대기"}
                            </span>
                            <ChevronRight size={13} />
                          </button>
                        );
                      })}
                      {!visible.length && (
                        <div className="empty compact">
                          <Search size={26} />
                          <p>
                            {project.entries.length
                              ? "일치하는 문자열이 없습니다."
                              : "원본 JSON을 먼저 가져오세요."}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="panel-footnote">
                      <Info size={13} /> 버튼·라벨·한줄 배너 지원
                    </div>
                  </section>
                  <section className="panel">
                    {entry ? (
                      <>
                        <div className="panel-header">
                          <h2>문자열 상세</h2>
                          <code>{entry.key}</code>
                        </div>
                        <div className="editor-content">
                          <div className="field-heading">
                            <label htmlFor="source-text">원본 문구</label>
                            <small>EN · 영어</small>
                          </div>
                          <textarea
                            id="source-text"
                            className="text-editor source"
                            value={entry.source}
                            disabled={!!busy}
                            onChange={(e) => edit({ source: e.target.value })}
                          />
                          <div className="field-heading">
                            <label htmlFor="translation-text">번역 문구</label>
                            <small>
                              {locale.toUpperCase()} · {language[locale]}
                            </small>
                          </div>
                          <textarea
                            id="translation-text"
                            className="text-editor"
                            value={entry.translations[locale]}
                            disabled={!!busy}
                            placeholder="번역문을 입력하거나 Google 번역을 연결하세요."
                            onChange={(e) =>
                              edit({
                                translations: { ...entry.translations, [locale]: e.target.value },
                              })
                            }
                          />
                          <div className="translation-meta">
                            <span>
                              {[...entry.translations[locale]].length}자 · 문자 수로 넘침을 판정하지
                              않습니다
                            </span>
                            <button
                              className="icon-button"
                              aria-label="번역문 복사"
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(entry.translations[locale])
                                  .then(() => setToast("번역문을 복사했습니다."))
                                  .catch(() => setError("클립보드 권한을 확인해 주세요."))
                              }
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <div
                            className={`inline-validation ${parity(entry.source, entry.translations[locale]).length ? "bad" : "good"}`}
                          >
                            {parity(entry.source, entry.translations[locale]).length ? (
                              <AlertTriangle size={15} />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                            <span>
                              {parity(entry.source, entry.translations[locale]).join(" · ") ||
                                "변수 무결성 확인됨 · 원문과 이름·개수가 일치합니다"}
                            </span>
                          </div>
                          <AiSuggestions
                            key={`${project.id}:${entry.key}:${locale}:${project.revision}:${JSON.stringify(project.conditions)}`}
                            project={project}
                            entry={entry}
                            locale={locale}
                            signedIn={status.signedIn}
                            connected={!!status.gemini}
                            disabled={!!busy}
                            onApply={applyAiSuggestion}
                            onSetup={() => setView("settings")}
                          />
                          <div className="divider" />
                          <div className="field-heading">
                            <h3>UI 미리보기</h3>
                            <small className="live-label">
                              <span className="dot green" /> 실제 브라우저 렌더링
                            </small>
                          </div>
                          <div className="preview-settings">
                            <label>
                              컴포넌트
                              <select
                                value={entry.component}
                                disabled={!!busy}
                                onChange={(e) =>
                                  edit({ component: e.target.value as Entry["component"] })
                                }
                              >
                                <option value="button">버튼</option>
                                <option value="label">라벨</option>
                                <option value="banner">한줄 배너</option>
                              </select>
                            </label>
                            <label>
                              폰트
                              <select
                                value={font}
                                onChange={(e) => setFont(e.target.value as Font)}
                              >
                                <option>Bench Sans</option>
                                <option>Bench Mono</option>
                              </select>
                            </label>
                            <small>{project.conditions.fontSize}px</small>
                          </div>
                          <div className="preview-area">
                            {project.conditions.widths.map((width) => {
                              const m = selectedRows.find(
                                (m) => m.width === width && m.font === font,
                              );
                              return (
                                <div className="preview-example" key={width}>
                                  <div className="dimension">
                                    <span />
                                    {width}px
                                    <span />
                                  </div>
                                  <div
                                    className={`fixture fixture-${entry.component} ${m?.overflow && fresh ? "fixture-fail" : ""}`}
                                    style={{
                                      width,
                                      padding: project.conditions.padding,
                                      fontFamily: `"${font}","Bench Sans"`,
                                      fontSize: project.conditions.fontSize,
                                      borderWidth: entry.component === "label" ? 0 : 1,
                                    }}
                                  >
                                    <div className="fixture-inner">
                                      <span>
                                        {simulate(entry.translations[locale], project.conditions)}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={`preview-result ${fresh && m?.overflow ? "bad" : ""}`}
                                  >
                                    {fresh && m ? (
                                      m.error ? (
                                        "측정 불가"
                                      ) : m.overflow ? (
                                        <>
                                          <AlertTriangle size={12} />
                                          {m.excess}px 초과
                                        </>
                                      ) : (
                                        <>
                                          <Check size={12} />
                                          공간에 맞음
                                        </>
                                      )
                                    ) : (
                                      "검사 후 측정값 표시"
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="runtime-strip">
                            <Braces size={16} />
                            <div>
                              <strong>변수 값 시뮬레이션</strong>
                              <small>
                                {project.conditions.scenario === "long"
                                  ? "Alexandria-Montgomery · 999,999"
                                  : "Kim · 3"}
                              </small>
                            </div>
                            <div className="mini-segmented">
                              {(["normal", "long"] as const).map((s) => (
                                <button
                                  key={s}
                                  className={s === project.conditions.scenario ? "selected" : ""}
                                  disabled={!!busy}
                                  onClick={() =>
                                    update((p) => ({
                                      ...p,
                                      conditions: { ...p.conditions, scenario: s },
                                    }))
                                  }
                                >
                                  {s === "normal" ? "기본" : "긴 값"}
                                </button>
                              ))}
                            </div>
                          </div>
                          {fresh && selectedRows.some((m) => m.overflow) && (
                            <div className="fix-card">
                              <strong>
                                <ArrowUpRight size={15} /> 이 문구에는 공간이 더 필요해요
                              </strong>
                              <p>
                                {font}에서 최대{" "}
                                {Math.max(
                                  ...selectedRows
                                    .filter((m) => m.font === font)
                                    .map((m) => m.suggestion),
                                  0,
                                )}
                                px의 외곽 폭이 필요합니다. 문구를 줄이거나 너비를 조정한 뒤
                                재검사하세요.
                              </p>
                              <small>수정안은 의미·디자인 품질을 보장하지 않습니다.</small>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="empty">
                        <Braces size={32} />
                        <h3>첫 문자열을 가져오세요</h3>
                        <p>flat JSON 파일 또는 텍스트를 입력할 수 있습니다.</p>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <Matrix
                  project={project}
                  locale={locale}
                  rows={rows}
                  onSelect={(e, f) => {
                    setSelected(e.key);
                    setFont(f);
                    setView("workspace");
                  }}
                />
              )}
              {latest && !fresh && (
                <div className="stale-notice">
                  <RotateCcw size={15} />
                  <span>입력이 바뀌었습니다. 현재 조건으로 다시 검사해 주세요.</span>
                  <button onClick={run} disabled={!!busy}>
                    재검사 <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </>
          )}
          {view === "results" && (
            <section className="panel">
              <div className="panel-header">
                <h2>
                  발견된 문제 <span>{issues.length}</span>
                </h2>
                <small>
                  {latest
                    ? `${date(latest.date)} · ${fresh ? "최신 결과" : "수정 전 결과"}`
                    : "실행 대기"}
                </small>
              </div>
              {latest ? (
                issues.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>문자열 / 언어</th>
                          <th>검사 조건</th>
                          <th>발견된 문제</th>
                          <th>필요한 외곽 폭</th>
                          <th>검토</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {issues.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <code>{m.key}</code>
                              <small>
                                {m.locale.toUpperCase()} · {language[m.locale]}
                              </small>
                            </td>
                            <td>
                              {m.width}px
                              <small>
                                {m.font} · {componentName[m.component]}
                              </small>
                            </td>
                            <td>
                              <span className={`pill ${m.variables.length ? "red" : "amber"}`}>
                                {m.error ||
                                  (m.variables.length ? "변수 오류" : `${m.excess}px 넘침`)}
                              </span>
                              {m.variables.length > 0 && <small>{m.variables.join(", ")}</small>}
                            </td>
                            <td>{m.error ? "—" : `${m.suggestion}px`}</td>
                            <td>
                              <button
                                className={`review-button ${project.reviewed.includes(m.id) ? "reviewed" : ""}`}
                                onClick={() =>
                                  update(
                                    (p) => ({
                                      ...p,
                                      reviewed: p.reviewed.includes(m.id)
                                        ? p.reviewed.filter((id) => id !== m.id)
                                        : [...p.reviewed, m.id],
                                    }),
                                    false,
                                  )
                                }
                              >
                                {project.reviewed.includes(m.id) ? "검토됨" : "미검토"}
                              </button>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`${m.key} ${m.locale} ${m.width} ${m.font} 수정`}
                                onClick={() => {
                                  setSelected(m.key);
                                  setLocale(m.locale);
                                  setView("workspace");
                                }}
                              >
                                <ArrowRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    <CheckCircle2 size={35} />
                    <h3>현재 검사에서 오류를 찾지 못했습니다</h3>
                    <p>이 결과는 저장된 fixture와 변수 예시 값에 한정됩니다.</p>
                  </div>
                )
              ) : (
                <EmptyRun onRun={run} />
              )}
              <div className="panel-footnote">
                <Info size={14} /> 검토 표시는 검사 결과를 지우지 않습니다. 수정 후 재검사로 해결
                여부를 확인하세요.
              </div>
            </section>
          )}
          {view === "history" && (
            <>
              <div className="regression-summary">
                <div>
                  <span className="eyebrow">REGRESSION CHECK</span>
                  <h2>수정 전후를, 같은 기준으로.</h2>
                  <p>{comparison?.reason || "검사를 두 번 실행하면 결과를 비교할 수 있습니다."}</p>
                </div>
                <div className="regression-counts">
                  {(
                    [
                      ["새 오류", "added"],
                      ["지속", "persistent"],
                      ["해결", "resolved"],
                    ] as const
                  ).map(([label, key]) => (
                    <span key={key} className={key}>
                      <strong>{comparison?.comparable ? comparison[key] : "—"}</strong>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="history-layout">
                <section className="panel">
                  <div className="panel-header">
                    <h2>최근 실행</h2>
                    <small>최대 20개</small>
                  </div>
                  {project.runs.map((r, i) => (
                    <button
                      className={`history-row ${activeRun?.id === r.id ? "selected" : ""}`}
                      key={r.id}
                      onClick={() => setHistoryId(r.id)}
                    >
                      <span className="run-icon">
                        <ScanLine size={17} />
                      </span>
                      <div>
                        <strong>
                          Run {project.runs.length - i}{" "}
                          <span className="pill neutral">v{r.revision}</span>
                        </strong>
                        <small>
                          {date(r.date)} · {r.measurements.length}개 조건
                        </small>
                      </div>
                      <span className="pill amber">
                        {r.measurements.filter(failed).length} 문제
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!project.runs.length && <EmptyRun onRun={run} />}
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h2>실행 스냅샷</h2>
                    {activeRun && (
                      <button
                        className="icon-button"
                        aria-label="선택한 실행 보고서 내보내기"
                        onClick={() => download(`run-${activeRun.id}.json`, activeRun)}
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                  {activeRun ? (
                    <div className="snapshot">
                      <p>
                        {activeRun.duration}ms ·{" "}
                        {activeRun.status === "completed" ? "측정 완료" : "부분 실패"}
                      </p>
                      <dl>
                        <dt>측정 엔진</dt>
                        <dd>{activeRun.engine}</dd>
                        <dt>폰트</dt>
                        <dd>{activeRun.conditions.fonts.join(" / ")}</dd>
                        <dt>외곽 너비</dt>
                        <dd>{activeRun.conditions.widths.join(" / ")}px</dd>
                        <dt>글자 / padding</dt>
                        <dd>
                          {activeRun.conditions.fontSize}px / {activeRun.conditions.padding}px
                        </dd>
                        <dt>변수 시나리오</dt>
                        <dd>{activeRun.conditions.scenario === "long" ? "긴 값" : "기본 값"}</dd>
                        <dt>뷰포트 / DPR</dt>
                        <dd>
                          {activeRun.viewport} / {activeRun.dpr}
                        </dd>
                      </dl>
                      <div className="settings-note">
                        <Info size={15} /> 당시 문구와 조건을 보관합니다. 현재 문구를 바꿔도 과거
                        결과는 바뀌지 않습니다.
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>언어</th>
                            <th>넘침</th>
                            <th>변수 오류</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LOCALES.map((l) => (
                            <tr key={l}>
                              <td>{language[l]}</td>
                              <td>
                                {
                                  activeRun.measurements.filter((m) => m.locale === l && m.overflow)
                                    .length
                                }
                              </td>
                              <td>
                                {
                                  new Set(
                                    activeRun.measurements
                                      .filter((m) => m.locale === l && m.variables.length)
                                      .map((m) => m.key),
                                  ).size
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">
                      <History size={30} />
                      <p>실행 결과가 없습니다.</p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-header">
                  <h2>프로젝트 검사 조건</h2>
                  <span className="pill neutral">고정 fixture</span>
                </div>
                <div className="settings-content">
                  <label className="form-field">
                    프로젝트 이름
                    <input
                      value={project.name}
                      maxLength={100}
                      onChange={(e) => update((p) => ({ ...p, name: e.target.value }), false)}
                    />
                  </label>
                  <div className="settings-pair">
                    <label className="form-field">
                      글자 크기
                      <select
                        value={project.conditions.fontSize}
                        disabled={!!busy}
                        onChange={(e) =>
                          update((p) => ({
                            ...p,
                            conditions: { ...p.conditions, fontSize: Number(e.target.value) },
                          }))
                        }
                      >
                        {[12, 14, 16, 18, 20, 24].map((n) => (
                          <option key={n} value={n}>
                            {n}px
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      내부 padding
                      <select
                        value={project.conditions.padding}
                        disabled={!!busy}
                        onChange={(e) =>
                          update((p) => ({
                            ...p,
                            conditions: { ...p.conditions, padding: Number(e.target.value) },
                          }))
                        }
                      >
                        {[0, 4, 8, 12, 16, 20, 24].map((n) => (
                          <option key={n} value={n}>
                            {n}px
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="form-field">
                    검사할 외곽 너비
                    <input
                      defaultValue={project.conditions.widths.join(", ")}
                      key={project.id + project.conditions.widths.join()}
                      onBlur={(e) => {
                        const widths = [
                          ...new Set(e.target.value.split(",").map((v) => Number(v.trim()))),
                        ];
                        if (
                          widths.length > 5 ||
                          !widths.length ||
                          widths.some((w) => !Number.isFinite(w) || w < 40 || w > 1000)
                        ) {
                          setError("너비는 40~1000px, 최대 5개를 쉼표로 구분해 주세요.");
                          e.target.value = project.conditions.widths.join(", ");
                        } else if (widths.join() !== project.conditions.widths.join())
                          update((p) => ({ ...p, conditions: { ...p.conditions, widths } }));
                      }}
                    />
                    <small>예: 100, 160, 240 · 최대 5개</small>
                  </label>
                  <label className="form-field">
                    사용자 지정 name 값
                    <input
                      value={project.conditions.variables.name ?? ""}
                      maxLength={100}
                      placeholder="비워두면 기본 / 긴 값 시나리오 사용"
                      onChange={(e) =>
                        update((p) => ({
                          ...p,
                          conditions: {
                            ...p.conditions,
                            variables: e.target.value
                              ? { ...p.conditions.variables, name: e.target.value }
                              : Object.fromEntries(
                                  Object.entries(p.conditions.variables).filter(
                                    ([k]) => k !== "name",
                                  ),
                                ),
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="settings-note">
                    <Info size={16} />
                    <span>
                      폰트는 고정된 Bench Sans / Bench Mono입니다. ICU·임의 코드 실행·전체 앱 CSS
                      재현은 지원하지 않습니다.
                    </span>
                  </div>
                  <button className="button danger quiet" onClick={() => setModal("delete")}>
                    <Trash2 size={15} /> 프로젝트 삭제
                  </button>
                </div>
              </section>
              <div>
                <section className="panel">
                  <div className="panel-header">
                    <h2>서비스 연결</h2>
                    <span className="pill green">로컬 사용 가능</span>
                  </div>
                  <Connection
                    icon={Laptop}
                    title="로컬 저장소"
                    detail="프로젝트와 최근 20개 실행 이력"
                    state="IndexedDB"
                    connected
                  />
                  <Connection
                    icon={Cloud}
                    title="클라우드 저장"
                    detail="로그인한 사용자별 DB에 보관"
                    state={status.cloud ? "연결됨" : "로그인 필요"}
                    connected={status.cloud}
                  />
                  {!status.signedIn && (
                    <a
                      className="button sign-in"
                      href="/signin-with-chatgpt?return_to=/"
                      target="_top"
                    >
                      ChatGPT로 로그인 <ArrowUpRight size={14} />
                    </a>
                  )}
                  <Connection
                    icon={Languages}
                    title="Google Cloud Translation"
                    detail="서버에서 변수 보호 후 Basic v2 호출"
                    state={status.google ? "키 설정됨" : "키 필요"}
                    connected={status.google}
                  />
                  <div className="connection-help">
                    <strong>생성형 AI · Google Gemini</strong>
                    <p>
                      {status.gemini
                        ? "Gemini AI 키 설정됨 · 문구 상세에서 짧은 후보 생성과 실측을 사용할 수 있습니다."
                        : "Gemini 키를 서버의 비밀 환경변수 GEMINI_API_KEY에 등록하세요. 실제 키를 원문이나 채팅에 넣지 마세요."}
                    </p>
                    <small>사용자당 하루 최대 20회 · 동일 입력은 AI 결과 캐시 재사용</small>
                    <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">
                      Google AI Studio 열기 <ArrowUpRight size={13} />
                    </a>
                  </div>
                  <div className="connection-help">
                    {status.google ? (
                      <>
                        <p>
                          오늘 예약 문자량{" "}
                          <strong>{(status.used ?? 0).toLocaleString()} / 20,000</strong>
                        </p>
                        <small>실패도 예약량에 포함되며 실제 청구량과 다를 수 있습니다.</small>
                      </>
                    ) : (
                      <>
                        <p>
                          서버 비공개 환경변수에 키를 입력하세요. 키를 채팅이나 원본 JSON에 넣지
                          마세요.
                        </p>
                        <code>GOOGLE_TRANSLATION_API_KEY</code>
                        <a
                          href="https://console.cloud.google.com/apis/library/translate.googleapis.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Translation 설정 열기 <ArrowUpRight size={13} />
                        </a>
                      </>
                    )}
                  </div>
                  <button
                    className="button quiet connection-refresh"
                    onClick={async () => {
                      try {
                        setStatus(await api<Status>("/api/status"));
                        setToast("연결 상태를 다시 확인했습니다.");
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  >
                    <RotateCcw size={14} /> 연결 상태 새로고침
                  </button>
                </section>
                <div className="support-note">
                  <Braces size={20} />
                  <div>
                    <strong>번역 품질보다, 화면 조건을 검증합니다.</strong>
                    <p>
                      API가 없어도 수동 번역과 샘플로 실제 DOM 검사·회귀 비교를 사용할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <span className="dot" />
              {ENGINE_VERSION} · 실제 브라우저 측정
            </span>
            <span>
              {latest ? `마지막 검사 ${date(latest.date)}` : "첫 검사를 실행해 주세요"} /
              LocaleBench
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button className="icon-button" aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <h2 id="modal-title">
                {modal === "new"
                  ? "새 프로젝트"
                  : modal === "import"
                    ? "원본 JSON 가져오기"
                    : modal === "restore"
                      ? "프로젝트 백업 복원"
                      : modal === "delete"
                        ? "프로젝트 삭제"
                        : "파일 내보내기"}
              </h2>
              <button
                className="icon-button"
                aria-label="대화상자 닫기"
                disabled={!!busy}
                onClick={() => {
                  setModal(null);
                  setError("");
                }}
              >
                <X size={19} />
              </button>
            </div>
            {modal === "new" ? (
              <>
                <p>작은 UI 문구부터 다국어 품질 검사를 시작하세요.</p>
                <label className="form-field">
                  프로젝트 이름
                  <input
                    autoFocus
                    maxLength={100}
                    placeholder="예: Checkout 다국어 QA"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="modal-actions">
                  <button className="button" onClick={() => add(true)}>
                    샘플 데이터로 시작
                  </button>
                  <button className="button primary" onClick={() => add()}>
                    프로젝트 만들기 <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : modal === "import" || modal === "restore" ? (
              <>
                <p>
                  {modal === "restore"
                    ? "내보낸 프로젝트 백업을 새 프로젝트로 복원합니다. 원본 프로젝트는 유지됩니다."
                    : "flat JSON만 지원합니다. 같은 키의 원문이 바뀌면 이전 번역을 초기화합니다."}
                </p>
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={file}
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > (modal === "restore" ? 4 * 1024 * 1024 : 256 * 1024))
                        setError(
                          modal === "restore"
                            ? "백업 파일은 4MiB 이하로 넣어 주세요."
                            : "파일은 256KiB 이하로 넣어 주세요.",
                        );
                      else setJson(await f.text());
                    }
                    e.target.value = "";
                  }}
                />
                <button className="button upload-button" onClick={() => file.current?.click()}>
                  <Upload size={16} /> JSON 파일 선택
                </button>
                <label className="form-field">
                  원본 JSON
                  <textarea
                    className="json-editor"
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                    spellCheck={false}
                  />
                </label>
                {error && (
                  <div className="alert" role="alert">
                    {error}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="button" onClick={() => setModal(null)}>
                    취소
                  </button>
                  <button
                    className="button primary"
                    onClick={modal === "restore" ? restoreBackup : importJson}
                  >
                    {modal === "restore" ? "백업 복원" : "문자열 가져오기"} <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : modal === "delete" ? (
              <>
                <div className="delete-warning">
                  <AlertTriangle size={28} />
                  <p>
                    <strong>{project.name}</strong>와 모든 실행 이력을 삭제합니다. 클라우드에 저장한
                    데이터도 삭제됩니다.
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="button" onClick={() => setModal(null)}>
                    취소
                  </button>
                  <button className="button danger" disabled={!!busy} onClick={remove}>
                    {busy || "삭제"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>검사 근거를 보관하거나 번역 파일을 프로젝트에 사용하세요.</p>
                <ExportOption
                  title="백업 복원"
                  detail="내보낸 프로젝트 파일로 새 프로젝트 만들기"
                  onClick={() => {
                    setJson("");
                    setError("");
                    setModal("restore");
                  }}
                />
                <ExportOption
                  title="프로젝트 백업"
                  detail="원본·번역·조건·최근 실행 이력"
                  onClick={() => download(`${project.name}-project.json`, project)}
                />
                <ExportOption
                  title={`${language[locale]} 번역 JSON`}
                  detail="변수 검증을 통과한 번역문"
                  onClick={exportTranslation}
                />
                <ExportOption
                  title="최근 검사 보고서"
                  detail="실측 결과와 입력 스냅샷"
                  disabled={!latest}
                  onClick={() => latest && download(`report-${latest.id}.json`, latest)}
                />
                {error && (
                  <div className="alert" role="alert">
                    {error}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  detail,
  color = "indigo",
}: {
  icon: typeof Braces;
  label: string;
  value: string;
  detail: string;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong>
        {value}
        <small>{label === "검사 조건" ? "cases" : "개"}</small>
      </strong>
      <p>{detail}</p>
    </div>
  );
}
function EmptyRun({ onRun }: { onRun: () => void }) {
  return (
    <div className="empty">
      <ScanLine size={34} />
      <h3>아직 검사 결과가 없습니다</h3>
      <p>실제 브라우저에서 여러 너비와 폰트를 검사해 보세요.</p>
      <button className="button primary" onClick={onRun}>
        <Play size={14} /> 첫 검사 실행
      </button>
    </div>
  );
}
function Connection({
  icon: Icon,
  title,
  detail,
  state,
  connected,
}: {
  icon: typeof Braces;
  title: string;
  detail: string;
  state: string;
  connected: boolean;
}) {
  return (
    <div className="connection-row">
      <span className="service-icon">
        <Icon size={21} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <span className={`pill ${connected ? "green" : "neutral"}`}>{state}</span>
    </div>
  );
}
function ExportOption({
  title,
  detail,
  onClick,
  disabled = false,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="export-option" disabled={disabled} onClick={onClick}>
      <FileJson size={22} />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Download size={17} />
    </button>
  );
}
function Matrix({
  project,
  locale,
  rows,
  onSelect,
}: {
  project: Project;
  locale: Locale;
  rows: Measurement[];
  onSelect: (e: Entry, f: Font) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>너비 × 폰트 검사</h2>
        <small>
          {language[locale]} · {project.runs[0] ? date(project.runs[0].date) : "실행 대기"}
        </small>
      </div>
      <div className="table-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>문자열 키</th>
              {project.conditions.fonts.flatMap((f) =>
                project.conditions.widths.map((w) => (
                  <th key={f + w}>
                    {w}px<small>{f.replace("Bench ", "")}</small>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {project.entries.map((e) => (
              <tr key={e.key}>
                <td>
                  <button onClick={() => onSelect(e, project.conditions.fonts[0])}>
                    <code>{e.key}</code>
                    <small>{e.source}</small>
                  </button>
                </td>
                {project.conditions.fonts.flatMap((f) =>
                  project.conditions.widths.map((w) => {
                    const m = rows.find(
                      (m) =>
                        m.key === e.key && m.locale === locale && m.font === f && m.width === w,
                    );
                    return (
                      <td key={f + w}>
                        <button
                          className={`matrix-cell ${m ? (failed(m) ? "fail" : "pass") : "pending"}`}
                          onClick={() => onSelect(e, f)}
                          title={m ? `텍스트 ${m.textWidth}px / 내부 ${m.available}px` : "미검사"}
                        >
                          {m ? (
                            m.error ? (
                              "측정 불가"
                            ) : m.variables.length ? (
                              "변수 오류"
                            ) : m.overflow ? (
                              `+${m.excess}px`
                            ) : (
                              <Check size={15} />
                            )
                          ) : (
                            "—"
                          )}
                        </button>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matrix-legend">
        <span>
          <i className="pass" />
          정상
        </span>
        <span>
          <i className="fail" />
          확인 필요
        </span>
        <span>
          <i />
          미검사
        </span>
        <small>허용 오차 0.5px · 외곽 폭 기준</small>
      </div>
    </section>
  );
}
