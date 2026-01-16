import { jaroWinkler } from '@skyra/jaro-winkler';
import type { NormalizedService } from '../utils/normalization';

export interface MatchResult {
  pagerDutyService: NormalizedService;
  backstageComponent: NormalizedService;
  score: number;
  scoreBreakdown: {
    baseScore: number;
    exactMatch: boolean;
    teamMatch: boolean;
    acronymMatch: boolean;
    rawScore: number;
  };
}

export interface MatchingConfig {
  threshold: number;
}

export function findMatches(
  pdServices: NormalizedService[],
  bsComponents: NormalizedService[],
  config: MatchingConfig,
): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const pdService of pdServices) {
    for (const bsComponent of bsComponents) {
      const matchResult = calculateMatchScore(pdService, bsComponent);

      if (matchResult.score >= config.threshold) {
        matches.push(matchResult);
      }
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.pagerDutyService.rawName.localeCompare(b.pagerDutyService.rawName);
  });

  return matches;
}

export function calculateMatchScore(
  pdService: NormalizedService,
  bsComponent: NormalizedService,
): MatchResult {
  const exactNameMatch =
    pdService.normalizedName === bsComponent.normalizedName;
  const exactTeamMatch =
    pdService.teamName !== '' &&
    bsComponent.teamName !== '' &&
    pdService.teamName === bsComponent.teamName;
  const exactMatch = exactNameMatch && exactTeamMatch;

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

  const jaroWinklerSimilarity = jaroWinkler(
    pdService.normalizedName,
    bsComponent.normalizedName,
  );
  const baseScore = jaroWinklerSimilarity * 100;

  const teamMatch =
    pdService.teamName !== '' &&
    bsComponent.teamName !== '' &&
    pdService.teamName === bsComponent.teamName;

  const acronymMatch =
    pdService.acronym !== '' &&
    bsComponent.acronym !== '' &&
    pdService.acronym === bsComponent.acronym;

  let rawScore = baseScore;

  if (teamMatch) {
    rawScore += 10;
  }

  if (acronymMatch) {
    rawScore += 5;
  }

  const finalScore = Math.min(rawScore, 100);

  return {
    pagerDutyService: pdService,
    backstageComponent: bsComponent,
    score: Math.round(finalScore * 100) / 100,
    scoreBreakdown: {
      baseScore: Math.round(baseScore * 100) / 100,
      exactMatch: false,
      teamMatch,
      acronymMatch,
      rawScore: Math.round(rawScore * 100) / 100,
    },
  };
}

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

export function filterToBestMatchPerService(
  matches: MatchResult[],
): MatchResult[] {
  const grouped = groupMatchesByService(matches);
  const bestMatches: MatchResult[] = [];

  for (const serviceMatches of grouped.values()) {
    if (serviceMatches.length > 0) {
      bestMatches.push(serviceMatches[0]);
    }
  }

  bestMatches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.pagerDutyService.rawName.localeCompare(b.pagerDutyService.rawName);
  });

  return bestMatches;
}
