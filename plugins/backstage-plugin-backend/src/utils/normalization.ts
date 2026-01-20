export function normalizeName(name: string): string {
  if (!name) {
    return '';
  }

  let normalized = name.toLowerCase();
  normalized = normalized.replace(/_/g, ' ').replace(/-/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
}

export function extractAcronym(name: string): string {
  if (!name) {
    return '';
  }

  if (name.length <= 5 && /^[A-Z]+$/.test(name)) {
    return name;
  }

  if (/[\s\-_]/.test(name)) {
    const words = name.split(/[\s\-_]+/).filter(word => word.length > 0);

    if (words.length === 0) {
      return '';
    }

    const acronym = words
      .map(word => word.charAt(0).toUpperCase())
      .join('');

    return acronym;
  }

  const withBoundaries = name
    .replace(/([a-z])([A-Z])/g, '$1|$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1|$2');

  const words = withBoundaries.split('|').filter(word => word.length > 0);

  if (words.length > 1) {
    return words
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  const capitals = name.match(/[A-Z]/g);
  if (capitals && capitals.length > 1) {
    return capitals.join('');
  }

  if (name.length > 0) {
    return name.charAt(0).toUpperCase();
  }

  return '';
}

export interface NormalizedService {
  rawName: string;
  normalizedName: string;
  teamName: string;
  acronym: string;
  sourceId: string;
  source: 'pagerduty' | 'backstage';
}

export function normalizeService(
  rawName: string,
  teamName: string,
  sourceId: string,
  source: 'pagerduty' | 'backstage',
): NormalizedService {
  return {
    rawName,
    normalizedName: normalizeName(rawName),
    teamName: normalizeName(teamName),
    acronym: extractAcronym(rawName),
    sourceId,
    source,
  };
}
