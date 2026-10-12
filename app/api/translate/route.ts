import { owner, database, failure, readJson, secret, HttpError, digest } from "../../../lib/server";
import { LOCALES, placeholders } from "../../../lib/domain";
import { googleTranslate } from "../../../lib/google";
export async function POST(request: Request) {
  try {
    const user = await owner(request);
    const key = secret("GOOGLE_TRANSLATION_API_KEY");
    if (!key)
      throw new HttpError(
        503,
        "API_KEY_MISSING",
        "Google 번역 키가 아직 설정되지 않았습니다. 수동 번역 또는 데모 데이터를 이용해 주세요.",
      );
    const input = (await readJson(request)) as {
      projectId: string;
      target: string;
      requestId: string;
    };
    if (
      !input ||
      !LOCALES.includes(input.target as (typeof LOCALES)[number]) ||
      typeof input.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(input.requestId) ||
      typeof input.projectId !== "string"
    )
      throw new HttpError(400, "INPUT", "대상 언어와 프로젝트를 확인해 주세요.");
    const db = database();
    const projectRow = await db
      .prepare("SELECT payload FROM projects WHERE id = ? AND owner_id = ?")
      .bind(input.projectId, user.userId)
      .first<{ payload: string }>();
    if (!projectRow)
      throw new HttpError(404, "NOT_FOUND", "먼저 프로젝트를 클라우드에 저장해 주세요.");
    const project = JSON.parse(projectRow.payload);
    const texts: string[] = project.entries.map((e: { source: string }) => e.source);
    if (!texts.length || texts.length > 100)
      throw new HttpError(400, "INPUT", "번역할 문자열이 없습니다.");
    for (const text of texts) placeholders(text);
    const chars = texts.reduce((sum, t) => sum + [...t].length, 0);
    if (chars > 18000)
      throw new HttpError(413, "CHAR_LIMIT", "한 번에 최대 18,000자를 번역할 수 있습니다.");
    const hash = await digest(JSON.stringify([user.userId, texts, input.target]));
    const cached = await db
      .prepare("SELECT payload FROM translation_cache WHERE id = ? AND owner_id = ?")
      .bind(hash, user.userId)
      .first<{ payload: string }>();
    if (cached) return Response.json({ ...JSON.parse(cached.payload), cached: true });
    const requestId = hash;
    const prior = await db
      .prepare("SELECT digest,status,payload FROM translation_requests WHERE id = ?")
      .bind(requestId)
      .first<{ digest: string; status: string; payload: string }>();
    if (prior?.status === "completed")
      return Response.json({ ...JSON.parse(prior.payload), cached: true });
    if (prior?.status === "running")
      throw new HttpError(
        409,
        "PENDING",
        "동일한 입력을 이미 번역 중입니다. 결과를 확인한 뒤 다시 시도해 주세요.",
      );
    const claimed = await db
      .prepare(
        "INSERT INTO translation_requests(id,owner_id,digest,status,created_at) VALUES(?,?,?,'running',?) ON CONFLICT(id) DO UPDATE SET status='running',created_at=excluded.created_at WHERE translation_requests.status IN ('failed','limited') RETURNING id",
      )
      .bind(requestId, user.userId, hash, new Date().toISOString())
      .first();
    if (!claimed) throw new HttpError(409, "PENDING", "이미 진행 중인 번역입니다.");
    // Reserve conservatively for masked text expansion. No automatic paid retries.
    const reserved = chars + texts.reduce((sum, t) => sum + placeholders(t).length * 80, 0);
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (reserved > 20000) {
      await db
        .prepare("UPDATE translation_requests SET status='limited' WHERE id=?")
        .bind(requestId)
        .run();
      throw new HttpError(
        429,
        "DAILY_LIMIT",
        "변수 보호 후 요청이 일일 한도를 넘습니다. 입력을 줄여 주세요.",
      );
    }
    const reservations = await db.batch([
      db
        .prepare(
          "INSERT INTO quota(id,used) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET used=used+excluded.used WHERE used+excluded.used<=20000 RETURNING used",
        )
        .bind(`${user.userId}:${day}`, reserved),
      db
        .prepare(
          "INSERT INTO quota(id,used) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET used=used+excluded.used WHERE used+excluded.used<=100000 RETURNING used",
        )
        .bind(`global:${day}`, reserved),
    ]);
    if (reserved > 20000 || reservations.some((r) => !r.results.length)) {
      await db
        .prepare("UPDATE translation_requests SET status='limited' WHERE id=?")
        .bind(requestId)
        .run();
      throw new HttpError(
        429,
        "DAILY_LIMIT",
        "앱의 일일 번역 한도에 도달했습니다. 수동 번역을 이용해 주세요.",
      );
    }
    try {
      const translations = await googleTranslate(texts, input.target, key);
      const payload = {
        translations,
        keys: project.entries.map((e: { key: string }) => e.key),
        target: input.target,
        chars: reserved,
        provider: "google",
      };
      await db.batch([
        db
          .prepare(
            "INSERT INTO translation_cache(id,owner_id,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(hash, user.userId, JSON.stringify(payload), new Date().toISOString()),
        db
          .prepare("UPDATE translation_requests SET status='completed',payload=? WHERE id=?")
          .bind(JSON.stringify(payload), requestId),
      ]);
      return Response.json(payload);
    } catch (error) {
      await db
        .prepare("UPDATE translation_requests SET status='failed' WHERE id=?")
        .bind(requestId)
        .run();
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
