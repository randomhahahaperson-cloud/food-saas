/** Shared helpers for the data-access layer. Only modules in src/worker/db/ may import this. */

export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export function newId(): string {
  return crypto.randomUUID();
}

export function isForeignKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("FOREIGN KEY constraint failed");
}

type SqlValue = string | number | null;

/**
 * Builds a "SET a = ?, b = ?" clause from a partial patch. Column names come only from the
 * fixed `columns` map, never from the patch, so callers can't inject SQL through keys.
 * Returns null when the patch has no fields to change.
 */
export function buildSet<P extends Record<string, unknown>>(
  patch: P,
  columns: { [K in keyof P]-?: string },
): { clause: string; values: SqlValue[] } | null {
  const parts: string[] = [];
  const values: SqlValue[] = [];
  for (const key of Object.keys(columns) as (keyof P)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    parts.push(`${columns[key]} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : (value as SqlValue));
  }
  return parts.length ? { clause: parts.join(", "), values } : null;
}
