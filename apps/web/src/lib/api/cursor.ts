export interface Cursor {
  at: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.at}|${c.id}`, 'utf-8').toString('base64url');
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const raw = Buffer.from(s, 'base64url').toString('utf-8');
    const idx = raw.indexOf('|');
    if (idx === -1) return null;
    const at = raw.slice(0, idx);
    const id = raw.slice(idx + 1);
    if (!at || !id) return null;
    return { at, id };
  } catch {
    return null;
  }
}

export interface PageResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    limit: number;
    hasMore: boolean;
  };
}

export function buildPage<T extends { created_at?: string; id: string }>(
  rows: T[],
  limit: number,
  cursorFrom: (row: T) => Cursor
): PageResult<T> {
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const last = sliced[sliced.length - 1];
  const cursor = hasMore && last ? encodeCursor(cursorFrom(last)) : null;
  return { data: sliced, pagination: { cursor, limit, hasMore } };
}
