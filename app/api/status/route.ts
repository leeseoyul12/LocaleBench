import { getChatGPTUser } from "../../chatgpt-auth";
import { secret, database, failure } from "../../../lib/server";
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ signedIn: false, cloud: false, google: false });
    const db = database();
    await db.prepare("SELECT 1 FROM projects LIMIT 1").first();
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const usage = await db
      .prepare("SELECT used FROM quota WHERE id = ?")
      .bind(`${user.userId}:${day}`)
      .first<{ used: number }>();
    return Response.json({
      signedIn: true,
      cloud: true,
      google: !!secret("GOOGLE_TRANSLATION_API_KEY"),
      name: user.displayName,
      used: usage?.used ?? 0,
      limit: 20000,
    });
  } catch (error) {
    return failure(error);
  }
}
