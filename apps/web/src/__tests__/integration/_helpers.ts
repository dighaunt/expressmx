import { NextRequest, NextResponse } from 'next/server';

export interface InvokeOptions {
  url?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface InvokeResult<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export async function invokeHandler<T = unknown>(
  handler: Handler,
  opts: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const baseUrl = opts.url ?? 'http://localhost:3000/test';
  const url = new URL(baseUrl);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }

  const headers = new Headers(opts.headers ?? {});
  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`);
  if (opts.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const req = opts.body
    ? new NextRequest(url, {
        method: opts.method ?? 'GET',
        headers,
        body: JSON.stringify(opts.body),
      })
    : new NextRequest(url, {
        method: opts.method ?? 'GET',
        headers,
      });

  const ctx = { params: Promise.resolve(opts.params ?? {}) };
  const res = await handler(req, ctx);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body: body as T, headers: res.headers };
}
