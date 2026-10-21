import { owner, database, failure, readJson, secret, HttpError, digest } from "../../../lib/server";
import { LOCALES, validateProject, type Locale } from "../../../lib/domain";
import { GEMINI_MODEL, suggestWithGemini } from "../../../lib/gemini";

export async function POST(request: Request) {
  try {
    const user = await owner(request);
    const key = secret("GEMINI_API_KEY");
    if (!key)
      throw new HttpError(503, "AI_KEY_MISSING", "Gemini AI 키가 아직 서버에 설정되지 않았습니다.");
    const input = (await readJson(request, 4096)) as {
      projectId?: string;
      entryKey?: string;
      target?: string;
    };
    if (
      !input ||
      typeof input.projectId !== "string" ||
      input.projectId.length > 100 ||
      typeof input.entryKey !== "string" ||
      input.entryKey.length > 160 ||
      !LOCALES.includes(input.target as Locale)
    )
      throw new HttpError(400, "INPUT", "프로젝트·문구·언어를 확인해 주세요.");
    const db = database();
    const row = await db
      .prepare("SELECT payload FROM projects WHERE id=? AND owner_id=?")
      .bind(input.projectId, user.userId)
      .first<{ payload: string }>();
    if (!row) throw new HttpError(404, "NOT_FOUND", "저장된 프로젝트를 찾지 못했습니다.");
    const project = validateProject(JSON.parse(row.payload));
    const entry = project.entries.find((e) => e.key === input.entryKey);
    const target = input.target as Locale;
    if (!entry?.source.trim() || !entry.translations[target]?.trim())
      throw new HttpError(400, "EMPTY", "원문과 현재 번역문을 먼저 입력해 주세요.");
    const model = secret("GEMINI_MODEL") || GEMINI_MODEL;
    if (!/^gemini-[a-zA-Z0-9.-]{1,80}$/.test(model))
      throw new HttpError(503, "MODEL", "서버의 Gemini 모델 설정을 확인해 주세요.");
    const id =
      "gemini:" +
      (await digest(JSON.stringify([user.userId, entry, target, project.conditions, model])));
    const cached = await db
      .prepare("SELECT payload FROM translation_cache WHERE id=? AND owner_id=?")
      .bind(id, user.userId)
      .first<{ payload: string }>();
    if (cached) return Response.json({ ...JSON.parse(cached.payload), cached: true });
    const claimed = await db
      .prepare(
        "INSERT INTO translation_requests(id,owner_id,digest,status,created_at) VALUES(?,?,?,'running',?) ON CONFLICT(id) DO UPDATE SET status='running',created_at=excluded.created_at WHERE translation_requests.status IN ('failed','limited') OR (translation_requests.status='running' AND translation_requests.created_at<?) RETURNING id",
      )
      .bind(
        id,
        user.userId,
        id,
        new Date().toISOString(),
        new Date(Date.now() - 60000).toISOString(),
      )
      .first();
    if (!claimed)
      throw new HttpError(
        409,
        "PENDING",
        "같은 문구의 AI 제안이 이미 진행 중입니다. 잠시 후 확인해 주세요.",
      );
    try {
      const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const reservations = await db.batch([
        db
          .prepare(
            "INSERT INTO quota(id,used) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used<20 RETURNING used",
          )
          .bind(`gemini:${user.userId}:${day}`),
        db
          .prepare(
            "INSERT INTO quota(id,used) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used<100 RETURNING used",
          )
          .bind(`gemini:global:${day}`),
      ]);
      if (reservations.some((r) => !r.results.length))
        throw new HttpError(
          429,
          "AI_LIMIT",
          "앱의 일일 AI 요청 한도에 도달했습니다. 사용자당 하루 20회까지 사용할 수 있습니다.",
        );
      const result = await suggestWithGemini(entry, target, project.conditions, key, model);
      await db.batch([
        db
          .prepare(
            "INSERT INTO translation_cache(id,owner_id,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(id, user.userId, JSON.stringify(result), new Date().toISOString()),
        db
          .prepare("UPDATE translation_requests SET status='completed',payload=? WHERE id=?")
          .bind(JSON.stringify(result), id),
      ]);
      return Response.json(result);
    } catch (error) {
      await db.prepare("UPDATE translation_requests SET status='failed' WHERE id=?").bind(id).run();
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
