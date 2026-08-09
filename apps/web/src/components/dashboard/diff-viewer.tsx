interface Props {
  before: unknown;
  after: unknown;
}

export function DiffViewer({ before, after }: Props) {
  const beforeKeys = isObject(before) ? Object.keys(before) : [];
  const afterKeys = isObject(after) ? Object.keys(after) : [];
  const allKeys = Array.from(new Set([...beforeKeys, ...afterKeys])).sort();

  if (allKeys.length > 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Campo</th>
              <th className="px-3 py-2 text-left">Antes</th>
              <th className="px-3 py-2 text-left">Después</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allKeys.map((key) => {
              const a = pluck(before, key);
              const b = pluck(after, key);
              const changed = !shallowEqual(a, b);
              return (
                <tr key={key} className={changed ? 'bg-warning/5' : undefined}>
                  <td className="px-3 py-2 font-mono">{key}</td>
                  <td className="px-3 py-2">
                    <Cell value={a} />
                  </td>
                  <td className={`px-3 py-2 ${changed ? 'font-semibold' : ''}`}>
                    <Cell value={b} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <details open className="rounded-md border border-border bg-card p-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          Antes
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px]">
          {pretty(before)}
        </pre>
      </details>
      <details open className="rounded-md border border-border bg-card p-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          Después
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px]">
          {pretty(after)}
        </pre>
      </details>
    </div>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-[10px]">{pretty(value).slice(0, 120)}</span>;
  }
  return <span className="font-mono">{String(value)}</span>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pluck(obj: unknown, key: string): unknown {
  return isObject(obj) ? obj[key] : undefined;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
