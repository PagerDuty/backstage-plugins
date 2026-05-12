import type { CatalogApi } from '@backstage/catalog-client';
import { AutoMatchEntityMappingsResponse } from '@pagerduty/backstage-plugin-common';
import { loadBothSources } from './dataLoader';
import {
  findMatches,
  filterToBestMatchPerService,
  type MatchingConfig,
} from './matchingEngine';
import type { AutoMatchJobParams } from './autoMatchJobs';

const getConfidenceLevel = (
  score: number,
): 'exact' | 'high' | 'medium' | 'low' => {
  if (score === 100) return 'exact';
  if (score >= 90) return 'high';
  if (score >= 80) return 'medium';
  return 'low';
};

export function createAutoMatchRunner(catalogApi: CatalogApi) {
  return async function runAutoMatch(
    params: AutoMatchJobParams,
  ): Promise<AutoMatchEntityMappingsResponse> {
    const { threshold, bestOnly, team, account } = params;

    const loadStartTime = Date.now();
    const { pdServices, bsComponents } = await loadBothSources({
      catalogApi,
      teamFilter: team,
    });

    const filteredPdServices = account
      ? pdServices.filter(service => service.account === account)
      : pdServices;

    const loadTime = Date.now() - loadStartTime;

    const matchStartTime = Date.now();
    const matchingConfig: MatchingConfig = { threshold };
    let matches = findMatches(filteredPdServices, bsComponents, matchingConfig);

    if (bestOnly) {
      matches = filterToBestMatchPerService(matches);
    }

    const matchTime = Date.now() - matchStartTime;

    const totalComparisons = filteredPdServices.length * bsComponents.length;
    const exactMatches = matches.filter(m => m.score === 100).length;
    const highConfidence = matches.filter(
      m => m.score >= 90 && m.score < 100,
    ).length;
    const mediumConfidence = matches.filter(
      m => m.score >= 80 && m.score < 90,
    ).length;

    return {
      matches: matches.map(m => ({
        pagerDutyService: {
          serviceId: m.pagerDutyService.sourceId,
          name: m.pagerDutyService.rawName,
          team: m.pagerDutyService.teamName,
          account: m.pagerDutyService.account,
        },
        backstageComponent: {
          entityRef: m.backstageComponent.sourceId,
          name: m.backstageComponent.rawName,
          owner: m.backstageComponent.teamName,
        },
        score: m.score,
        confidence: getConfidenceLevel(m.score),
        scoreBreakdown: m.scoreBreakdown,
      })),
      statistics: {
        totalPagerDutyServices: filteredPdServices.length,
        totalBackstageComponents: bsComponents.length,
        totalPossibleComparisons: totalComparisons,
        matchesFound: matches.length,
        exactMatches,
        highConfidenceMatches: highConfidence,
        mediumConfidenceMatches: mediumConfidence,
        threshold,
        loadTimeMs: loadTime,
        matchTimeMs: matchTime,
        totalTimeMs: loadTime + matchTime,
      },
    };
  };
}
