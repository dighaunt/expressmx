import { inspect } from 'node:util';

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? value.message;
  return inspect(value, { colors: false, depth: 6, breakLength: Infinity });
}

function write(stream: NodeJS.WriteStream, args: unknown[]): void {
  stream.write(`${args.map(formatArg).join(' ')}\n`);
}

export function logInfo(...args: unknown[]): void {
  write(process.stdout, args);
}

export function logWarn(...args: unknown[]): void {
  write(process.stderr, args);
}

export function logError(...args: unknown[]): void {
  write(process.stderr, args);
}
