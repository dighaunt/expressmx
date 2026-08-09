const appSchemes = new Set(['expressmx', 'com.expressmx.client']);
const defaultPath = '/(tabs)/home';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const nextPath = path.trim();

  if (!nextPath || nextPath === '/' || nextPath === '//') {
    return defaultPath;
  }

  try {
    const url = new URL(nextPath);
    const scheme = url.protocol.replace(':', '');

    if (!appSchemes.has(scheme)) {
      return nextPath;
    }

    if (url.hostname === 'expo-development-client' || url.pathname.includes('expo-development-client')) {
      return nextPath;
    }

    const normalizedPath = normalizeAppPath(url);
    return normalizedPath === '/' ? defaultPath : normalizedPath;
  } catch {
    return nextPath;
  }
}

function normalizeAppPath(url: URL): string {
  const hostPath = url.hostname ? `/${url.hostname}` : '';
  const pathname = url.pathname || '';
  const routePath = `${hostPath}${pathname}`.replace(/\/+/g, '/') || '/';

  return `${routePath}${url.search}${url.hash}`;
}
