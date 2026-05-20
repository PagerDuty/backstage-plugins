import { Entity } from '@backstage/catalog-model';

export type ExtractResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function extractValueAtPath(entity: Entity, path: string): ExtractResult {
  if (!path || typeof path !== 'string') {
    return { ok: false, reason: 'empty path' };
  }

  const segments = parsePath(path);
  if (segments === null) {
    return { ok: false, reason: `invalid path syntax: ${path}` };
  }

  let current: unknown = entity;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return { ok: false, reason: `path resolves to ${current} at "${segment}"` };
    }
    if (typeof current !== 'object') {
      return { ok: false, reason: `cannot index into non-object at "${segment}"` };
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (current === null || current === undefined) {
    return { ok: false, reason: 'path resolves to undefined' };
  }
  if (typeof current === 'object') {
    return { ok: false, reason: 'path resolves to an object/array, expected scalar' };
  }
  return { ok: true, value: String(current) };
}

function parsePath(path: string): string[] | null {
  const segments: string[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '[') {
      const end = findMatchingBracket(path, i);
      if (end === -1) return null;
      const inner = path.slice(i + 1, end).trim();
      const unquoted = unquote(inner);
      if (unquoted === null) return null;
      segments.push(unquoted);
      i = end + 1;
      if (i < path.length && path[i] === '.') i++;
      continue;
    }

    let end = i;
    while (end < path.length && path[end] !== '.' && path[end] !== '[') end++;
    const segment = path.slice(i, end);
    if (!segment) return null;
    segments.push(segment);
    i = end;
    if (path[i] === '.') i++;
  }
  return segments.length > 0 ? segments : null;
}

function findMatchingBracket(path: string, openIdx: number): number {
  for (let i = openIdx + 1; i < path.length; i++) {
    if (path[i] === ']') return i;
  }
  return -1;
}

function unquote(s: string): string | null {
  if (s.length === 0) return null;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
