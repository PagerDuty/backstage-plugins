/**
 * String Normalization Utilities for Service Matching
 *
 * This module provides functions to normalize service and team names
 * from both PagerDuty and Backstage to enable fuzzy matching.
 *
 * Based on the proven algorithm from:
 * https://github.com/PagerDuty/backstage-mapping
 *
 * @packageDocumentation
 */

/**
 * Performs basic normalization of service/team names.
 *
 * This is used for Stage 3 matching (fuzzy name matching).
 *
 * Transformations:
 * - Convert to lowercase
 * - Replace underscores with spaces
 * - Replace hyphens with spaces
 * - Collapse multiple whitespaces into single space
 * - Trim leading/trailing whitespace
 *
 * @param name - The service or team name to normalize
 * @returns Normalized name suitable for basic fuzzy matching
 *
 * @example
 * ```typescript
 * normalizeName('My_Service-Name')  // returns: 'my service name'
 * normalizeName('API   Service')     // returns: 'api service'
 * normalizeName('  Test_API-v2  ')   // returns: 'test api v2'
 * ```
 */
export function normalizeName(name: string): string {
  if (!name) {
    return '';
  }

  let normalized = name.toLowerCase();

  // Replace underscores and hyphens with spaces
  normalized = normalized.replace(/_/g, ' ').replace(/-/g, ' ');

  // Collapse multiple whitespaces into single space
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
}

/**
 * Performs advanced preprocessing for weighted fuzzy matching.
 *
 * This is used for Stage 5 matching (weighted fuzzy with team).
 * Removes structural noise patterns while preserving meaningful words.
 *
 * Transformations applied in order:
 * 1. Remove [prefix] tags (e.g., "[Team] Service" → "Service")
 * 2. Remove (parenthetical) notes (e.g., "Service (notes)" → "Service")
 * 3. Convert to lowercase
 * 4. Remove non-alphanumeric characters at the start
 * 5. Replace underscores and spaces with hyphens
 * 6. Collapse multiple hyphens
 * 7. Trim leading/trailing hyphens
 *
 * @param name - The service or team name to preprocess
 * @returns Preprocessed name optimized for fuzzy matching
 *
 * @example
 * ```typescript
 * preprocessForMatching('[Platform] Auth Service')
 * // returns: 'auth-service'
 *
 * preprocessForMatching('Payment Service (on-call)')
 * // returns: 'payment-service-on-call'
 *
 * preprocessForMatching('API_Gateway')
 * // returns: 'api-gateway'
 *
 * preprocessForMatching('#2 Jira Cloud')
 * // returns: '2-jira-cloud'
 * ```
 */
export function preprocessForMatching(name: string): string {
  if (!name) {
    return '';
  }

  let processed = name;

  // Remove [prefix] tags: "[Team] Service" → "Service"
  processed = processed.replace(/^\[.*?\]\s*/, '');

  // Remove (parenthetical) notes: "Service (notes)" → "Service"
  processed = processed.replace(/\s*\(.*?\)/g, '');

  // Normalize to lowercase
  processed = processed.toLowerCase();

  // Remove non-alphanumeric characters (except spaces, hyphens, underscores) at the start
  processed = processed.replace(/^[^a-z0-9\s_-]+/, '');

  // Replace underscores and spaces with hyphens
  processed = processed.replace(/_/g, '-').replace(/\s+/g, '-');

  // Collapse multiple hyphens into single hyphen
  processed = processed.replace(/-+/g, '-');

  // Trim leading and trailing hyphens
  processed = processed.replace(/^-+|-+$/g, '');

  return processed;
}

/**
 * Extracts an acronym from a service name.
 *
 * Handles two common patterns:
 * - CamelCase: "MyServiceName" → "MSN"
 * - Space-separated: "My Service Name" → "MSN"
 *
 * This is used as an additional matching signal (+5% in scoring).
 *
 * @param name - The service name to extract acronym from
 * @returns Uppercase acronym
 *
 * @example
 * ```typescript
 * extractAcronym('MyServiceName')       // returns: 'MSN'
 * extractAcronym('My Service Name')     // returns: 'MSN'
 * extractAcronym('API Gateway Service') // returns: 'AGS'
 * extractAcronym('my-service-name')     // returns: 'MSN'
 * ```
 */
export function extractAcronym(name: string): string {
  if (!name) {
    return '';
  }

  // First check if it's all capitals (already an acronym)
  if (name.length <= 5 && /^[A-Z]+$/.test(name)) {
    return name;
  }

  // Check if name has explicit word separators (spaces, hyphens, underscores)
  // If so, use word-splitting logic instead of CamelCase
  if (/[\s\-_]/.test(name)) {
    const words = name.split(/[\s\-_]+/).filter(word => word.length > 0);

    if (words.length === 0) {
      return '';
    }

    // Take first letter of each word
    const acronym = words
      .map(word => word.charAt(0).toUpperCase())
      .join('');

    return acronym;
  }

  // Try CamelCase pattern for names without separators
  // Split CamelCase into words by adding boundaries:
  // - Before uppercase letter after lowercase: "myService" → "my|Service"
  // - Before uppercase letter followed by lowercase after uppercase: "APIGateway" → "API|Gateway"
  const withBoundaries = name
    // Add boundary before uppercase after lowercase
    .replace(/([a-z])([A-Z])/g, '$1|$2')
    // Add boundary before uppercase followed by lowercase, when preceded by uppercase
    // This handles: "APIGateway" → "API|Gateway"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1|$2');

  const words = withBoundaries.split('|').filter(word => word.length > 0);

  if (words.length > 1) {
    // Take first letter of each word
    return words
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  // Fallback: if we have multiple capitals, return them
  const capitals = name.match(/[A-Z]/g);
  if (capitals && capitals.length > 1) {
    return capitals.join('');
  }

  // Last resort: single word, return first letter
  if (name.length > 0) {
    return name.charAt(0).toUpperCase();
  }

  return '';
}

/**
 * Data structure for a normalized service.
 *
 * Used to hold both original and normalized versions of service data
 * for matching algorithms.
 */
export interface NormalizedService {
  /** Original raw service name (unchanged) */
  rawName: string;

  /** Normalized name (from normalizeName or preprocessForMatching) */
  normalizedName: string;

  /** Team/owner name (normalized) */
  teamName: string;

  /** Acronym extracted from service name */
  acronym: string;

  /** Unique identifier (PagerDuty service ID or Backstage entity ref) */
  sourceId: string;

  /** Source system: 'pagerduty' or 'backstage' */
  source: 'pagerduty' | 'backstage';
}

/**
 * Normalizes a PagerDuty or Backstage service for matching.
 *
 * Creates a NormalizedService object with multiple representations
 * of the service name for different matching stages.
 *
 * @param rawName - Original service name
 * @param teamName - Team/owner name
 * @param sourceId - Unique identifier
 * @param source - Source system ('pagerduty' or 'backstage')
 * @param useAdvancedPreprocessing - If true, use preprocessForMatching, otherwise normalizeName
 * @returns NormalizedService object ready for matching
 *
 * @example
 * ```typescript
 * const normalized = normalizeService(
 *   '[Platform] Auth Service (on-call)',
 *   'Platform Team',
 *   'P4H6SXP',
 *   'pagerduty',
 *   true
 * );
 * // Result:
 * // {
 * //   rawName: '[Platform] Auth Service (on-call)',
 * //   normalizedName: 'auth-service',
 * //   teamName: 'platform-team',
 * //   acronym: 'AS',
 * //   sourceId: 'P4H6SXP',
 * //   source: 'pagerduty'
 * // }
 * ```
 */
export function normalizeService(
  rawName: string,
  teamName: string,
  sourceId: string,
  source: 'pagerduty' | 'backstage',
  useAdvancedPreprocessing: boolean = false,
): NormalizedService {
  return {
    rawName,
    normalizedName: useAdvancedPreprocessing
      ? preprocessForMatching(rawName)
      : normalizeName(rawName),
    teamName: useAdvancedPreprocessing
      ? preprocessForMatching(teamName)
      : normalizeName(teamName),
    acronym: extractAcronym(rawName),
    sourceId,
    source,
  };
}
