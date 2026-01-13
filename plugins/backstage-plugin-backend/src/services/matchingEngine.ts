/**
 * Matching Engine Module
 *
 * This module implements the auto-matching algorithm that finds potential
 * matches between PagerDuty services and Backstage components.
 *
 * Algorithm:
 * 1. If canonical name match AND canonical team match → 100% score
 * 2. Calculate base score using Jaro-Winkler distance on normalized names
 * 3. Add +10% if team names match
 * 4. Add +5% if acronyms match
 * 5. Cap final score at 100%
 * 6. Filter by threshold
 *
 * @module services/matchingEngine
 */

import { jaroWinkler } from '@skyra/jaro-winkler';
import type { NormalizedService } from '../utils/normalization';

/**
 * Represents a scored match between a PagerDuty service and a Backstage component
 */
export interface MatchResult {
  /** The PagerDuty service that was matched */
  pagerDutyService: NormalizedService;

  /** The Backstage component that was matched */
  backstageComponent: NormalizedService;

  /** The confidence score of the match (0-100) */
  score: number;

  /** Breakdown of how the score was calculated */
  scoreBreakdown: {
    /** Base score from Jaro-Winkler name comparison (0-100) */
    baseScore: number;

    /** Was there an exact canonical match? */
    exactMatch: boolean;

    /** Did the team names match? (+10%) */
    teamMatch: boolean;

    /** Did the acronyms match? (+5%) */
    acronymMatch: boolean;

    /** Final calculated score before capping */
    rawScore: number;
  };
}

/**
 * Configuration for the matching algorithm
 */
export interface MatchingConfig {
  /** Minimum confidence score threshold (0-100) */
  threshold: number;
}

/**
 * Find matches between PagerDuty services and Backstage components
 *
 * @param pdServices - Array of normalized PagerDuty services
 * @param bsComponents - Array of normalized Backstage components
 * @param config - Matching configuration (threshold)
 * @returns Array of match results sorted by score (highest first)
 *
 * @example
 * ```typescript
 * const matches = findMatches(pdServices, bsComponents, { threshold: 80 });
 * console.log(`Found ${matches.length} matches above 80% threshold`);
 * ```
 */
export function findMatches(
  pdServices: NormalizedService[],
  bsComponents: NormalizedService[],
  config: MatchingConfig,
): MatchResult[] {
  const matches: MatchResult[] = [];

  // For each PagerDuty service, compare against all Backstage components
  for (const pdService of pdServices) {
    for (const bsComponent of bsComponents) {
      const matchResult = calculateMatchScore(pdService, bsComponent);

      // Only include matches that meet or exceed the threshold
      if (matchResult.score >= config.threshold) {
        matches.push(matchResult);
      }
    }
  }

  // Sort by score (highest first), then by PagerDuty service name
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.pagerDutyService.rawName.localeCompare(b.pagerDutyService.rawName);
  });

  return matches;
}

/**
 * Calculate the match score between a single PagerDuty service and Backstage component
 *
 * Scoring Algorithm:
 * 1. **Exact Match (100%)**: If both canonical name AND canonical team match exactly
 * 2. **Base Score**: Jaro-Winkler similarity on normalized names (0-100%)
 * 3. **Team Bonus (+10%)**: If team names match (using normalized comparison)
 * 4. **Acronym Bonus (+5%)**: If acronyms match
 * 5. **Cap at 100%**: Final score cannot exceed 100%
 *
 * @param pdService - PagerDuty service (normalized)
 * @param bsComponent - Backstage component (normalized)
 * @returns Match result with score and breakdown
 *
 * @internal
 */
export function calculateMatchScore(
  pdService: NormalizedService,
  bsComponent: NormalizedService,
): MatchResult {
  // Check for exact match (both canonical name AND canonical team must match)
  const exactNameMatch =
    pdService.normalizedName === bsComponent.normalizedName;
  const exactTeamMatch =
    pdService.teamName !== '' &&
    bsComponent.teamName !== '' &&
    pdService.teamName === bsComponent.teamName;
  const exactMatch = exactNameMatch && exactTeamMatch;

  // If exact match, return 100% immediately
  if (exactMatch) {
    return {
      pagerDutyService: pdService,
      backstageComponent: bsComponent,
      score: 100,
      scoreBreakdown: {
        baseScore: 100,
        exactMatch: true,
        teamMatch: true,
        acronymMatch:
          pdService.acronym !== '' &&
          bsComponent.acronym !== '' &&
          pdService.acronym === bsComponent.acronym,
        rawScore: 100,
      },
    };
  }

  // Calculate base score using Jaro-Winkler on normalized names
  // Jaro-Winkler returns a value between 0 and 1
  const jaroWinklerSimilarity = jaroWinkler(
    pdService.normalizedName,
    bsComponent.normalizedName,
  );
  const baseScore = jaroWinklerSimilarity * 100; // Convert to percentage

  // Check for team name match (both must be non-empty and equal)
  const teamMatch =
    pdService.teamName !== '' &&
    bsComponent.teamName !== '' &&
    pdService.teamName === bsComponent.teamName;

  // Check for acronym match (both must be non-empty and equal)
  const acronymMatch =
    pdService.acronym !== '' &&
    bsComponent.acronym !== '' &&
    pdService.acronym === bsComponent.acronym;

  // Calculate raw score with bonuses
  let rawScore = baseScore;

  if (teamMatch) {
    rawScore += 10; // +10% for team match
  }

  if (acronymMatch) {
    rawScore += 5; // +5% for acronym match
  }

  // Cap at 100%
  const finalScore = Math.min(rawScore, 100);

  return {
    pagerDutyService: pdService,
    backstageComponent: bsComponent,
    score: Math.round(finalScore * 100) / 100, // Round to 2 decimal places
    scoreBreakdown: {
      baseScore: Math.round(baseScore * 100) / 100,
      exactMatch: false,
      teamMatch,
      acronymMatch,
      rawScore: Math.round(rawScore * 100) / 100,
    },
  };
}

/**
 * Find the best match for a single PagerDuty service
 *
 * Returns the highest-scoring Backstage component match, or undefined if
 * no matches meet the threshold.
 *
 * @param pdService - PagerDuty service to find a match for
 * @param bsComponents - Array of Backstage components to compare against
 * @param config - Matching configuration (threshold)
 * @returns Best match result, or undefined if no match meets threshold
 *
 * @example
 * ```typescript
 * const bestMatch = findBestMatch(service, components, { threshold: 90 });
 * if (bestMatch) {
 *   console.log(`Best match: ${bestMatch.backstageComponent.rawName} (${bestMatch.score}%)`);
 * }
 * ```
 */
export function findBestMatch(
  pdService: NormalizedService,
  bsComponents: NormalizedService[],
  config: MatchingConfig,
): MatchResult | undefined {
  let bestMatch: MatchResult | undefined;

  for (const bsComponent of bsComponents) {
    const matchResult = calculateMatchScore(pdService, bsComponent);

    if (
      matchResult.score >= config.threshold &&
      (!bestMatch || matchResult.score > bestMatch.score)
    ) {
      bestMatch = matchResult;
    }
  }

  return bestMatch;
}

/**
 * Group matches by PagerDuty service
 *
 * Returns a map where each PagerDuty service ID maps to an array of
 * potential Backstage component matches, sorted by score.
 *
 * @param matches - Array of match results
 * @returns Map of PagerDuty service ID to array of matches
 *
 * @example
 * ```typescript
 * const groupedMatches = groupMatchesByService(matches);
 * for (const [serviceId, serviceMatches] of groupedMatches) {
 *   console.log(`Service ${serviceId} has ${serviceMatches.length} matches`);
 * }
 * ```
 */
export function groupMatchesByService(
  matches: MatchResult[],
): Map<string, MatchResult[]> {
  const grouped = new Map<string, MatchResult[]>();

  for (const match of matches) {
    const serviceId = match.pagerDutyService.sourceId;

    if (!grouped.has(serviceId)) {
      grouped.set(serviceId, []);
    }

    grouped.get(serviceId)!.push(match);
  }

  return grouped;
}

/**
 * Filter matches to return only the best match for each PagerDuty service
 *
 * This is useful when you want to auto-create mappings and need to ensure
 * each service is matched to at most one component.
 *
 * @param matches - Array of match results
 * @returns Array of matches with only the best match per service
 *
 * @example
 * ```typescript
 * const allMatches = findMatches(pdServices, bsComponents, { threshold: 80 });
 * const bestMatches = filterToBestMatchPerService(allMatches);
 * console.log(`Creating ${bestMatches.length} auto-mappings`);
 * ```
 */
export function filterToBestMatchPerService(
  matches: MatchResult[],
): MatchResult[] {
  const grouped = groupMatchesByService(matches);
  const bestMatches: MatchResult[] = [];

  for (const serviceMatches of grouped.values()) {
    if (serviceMatches.length > 0) {
      // Matches are already sorted by score, so take the first one
      bestMatches.push(serviceMatches[0]);
    }
  }

  // Sort by score again
  bestMatches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.pagerDutyService.rawName.localeCompare(b.pagerDutyService.rawName);
  });

  return bestMatches;
}
