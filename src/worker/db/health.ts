export async function pingDatabase(db: D1Database): Promise<void> {
  await db.prepare("SELECT 1").first();
}
