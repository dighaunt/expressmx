const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/)?$/i;

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getPublicAppUrl(): string {
  const raw =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!raw) {
    throw new Error('APP_URL or VERCEL_PROJECT_PRODUCTION_URL is required');
  }

  const url = withProtocol(raw.trim()).replace(/\/+$/, '');

  if (process.env.NODE_ENV === 'production' && LOCAL_HOST_RE.test(url)) {
    throw new Error('Public app URL cannot point to localhost in production');
  }

  return url;
}
