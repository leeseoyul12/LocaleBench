import { database, owner, failure, HttpError } from "../../../../lib/server";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await owner(request);
    const { id } = await params;
    const db = database();
    const project = await db
      .prepare("SELECT owner_id FROM projects WHERE id = ?")
      .bind(id)
      .first<{ owner_id: string }>();
    if (!project || project.owner_id !== user.userId)
      throw new HttpError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    await db.batch([
      db.prepare("DELETE FROM runs WHERE project_id = ?").bind(id),
      db.prepare("DELETE FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.userId),
    ]);
    return Response.json({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
