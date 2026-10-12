import { database, owner, failure, readJson, HttpError } from "../../../lib/server";
import { validateProject, validateRun, type Run } from "../../../lib/domain";
export async function GET() {
  try {
    const user = await owner();
    const db = database();
    const { results } = await db
      .prepare("SELECT payload FROM projects WHERE owner_id = ? ORDER BY updated_at DESC")
      .bind(user.userId)
      .all<{ payload: string }>();
    const projects = [];
    for (const row of results) {
      const project = JSON.parse(row.payload);
      const runs = await db
        .prepare("SELECT payload FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 20")
        .bind(project.id)
        .all<{ payload: string }>();
      projects.push({ ...project, runs: runs.results.map((r) => JSON.parse(r.payload)) });
    }
    return Response.json({ projects });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await owner(request);
    const project = validateProject(await readJson(request, 4 * 1024 * 1024));
    const db = database();
    const existing = await db
      .prepare("SELECT owner_id FROM projects WHERE id = ?")
      .bind(project.id)
      .first<{ owner_id: string }>();
    if (existing && existing.owner_id !== user.userId)
      throw new HttpError(403, "OWNER", "이 프로젝트에 접근할 수 없습니다.");
    const saved = { ...project, runs: [], updatedAt: new Date().toISOString() };
    const projectCount = await db
      .prepare("SELECT count(*) AS n FROM projects WHERE owner_id = ?")
      .bind(user.userId)
      .first<{ n: number }>();
    if (!existing && (projectCount?.n ?? 0) >= 30)
      throw new HttpError(
        400,
        "PROJECT_LIMIT",
        "클라우드 프로젝트는 최대 30개까지 저장할 수 있습니다.",
      );
    if (!Array.isArray(project.runs) || project.runs.length > 20)
      throw new HttpError(400, "RUN_LIMIT", "최대 20개 실행 기록을 동기화할 수 있습니다.");
    const queries = [
      db
        .prepare(
          "INSERT INTO projects(id,owner_id,name,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload=excluded.payload,updated_at=excluded.updated_at WHERE projects.owner_id=excluded.owner_id RETURNING id",
        )
        .bind(saved.id, user.userId, saved.name, JSON.stringify(saved), saved.updatedAt),
    ];
    for (const run of project.runs as Run[]) {
      validateRun(run);
      if (
        !run ||
        typeof run.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(run.id) ||
        !Array.isArray(run.measurements) ||
        run.measurements.length > 3000 ||
        !Array.isArray(run.snapshot) ||
        run.snapshot.length > 100 ||
        typeof run.date !== "string" ||
        !Number.isFinite(Date.parse(run.date))
      )
        throw new HttpError(400, "RUN_INPUT", "실행 기록 형식이 올바르지 않습니다.");
      const duplicate = await db
        .prepare("SELECT project_id FROM runs WHERE id = ?")
        .bind(run.id)
        .first<{ project_id: string }>();
      if (duplicate && duplicate.project_id !== project.id)
        throw new HttpError(403, "OWNER", "다른 프로젝트의 실행 기록입니다.");
      queries.push(
        db
          .prepare(
            "INSERT INTO runs(id,project_id,payload,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM projects WHERE id=? AND owner_id=?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(run.id, project.id, JSON.stringify(run), run.date, project.id, user.userId),
      );
    }
    const committed = await db.batch(queries);
    if (!committed[0].results.length)
      throw new HttpError(403, "OWNER", "이 프로젝트에 접근할 수 없습니다.");
    return Response.json({ saved: true, date: saved.updatedAt });
  } catch (error) {
    return failure(error);
  }
}
