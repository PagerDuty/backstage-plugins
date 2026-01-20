/**
 * Unit tests for Matching Engine Module
 *
 * Tests the auto-matching algorithm that finds matches between
 * PagerDuty services and Backstage components.
 *
 * @group unit/services/matchingEngine
 */

import {
  findMatches,
  calculateMatchScore,
  groupMatchesByService,
  filterToBestMatchPerService,
  type MatchResult,
  type MatchingConfig,
} from './matchingEngine';
import type { NormalizedService } from '../utils/normalization';

describe('calculateMatchScore', () => {
  it('returns 100% for exact canonical match (name + team)', () => {
    const pdService: NormalizedService = {
      rawName: '[Platform] Auth Service (on-call)',
      normalizedName: 'platform auth service',
      teamName: 'platform team',
      acronym: 'PAS',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'platform-auth-service',
      normalizedName: 'platform auth service', // Exact match
      teamName: 'platform team', // Exact match
      acronym: 'PAS',
      sourceId: 'component:default/platform-auth-service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.score).toBe(100);
    expect(result.scoreBreakdown.exactMatch).toBe(true);
    expect(result.scoreBreakdown.teamMatch).toBe(true);
    expect(result.scoreBreakdown.baseScore).toBe(100);
  });

  it('does not give exact match if team is missing', () => {
    const pdService: NormalizedService = {
      rawName: 'Auth Service',
      normalizedName: 'auth service',
      teamName: '', // No team
      acronym: 'AS',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'auth-service',
      normalizedName: 'auth service', // Name matches
      teamName: 'platform team', // Team doesn't match (PD has no team)
      acronym: 'AS',
      sourceId: 'component:default/auth-service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    // Should not be marked as "exact match" since team requirement isn't met
    expect(result.scoreBreakdown.exactMatch).toBe(false);
    // Score may still be 100% from base Jaro-Winkler + acronym bonus, but not from exact match path
    // The key assertion is that exactMatch flag is false
  });

  it('calculates base score using Jaro-Winkler for similar names', () => {
    const pdService: NormalizedService = {
      rawName: 'Authentication Service',
      normalizedName: 'authentication service',
      teamName: '',
      acronym: '',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'auth-service',
      normalizedName: 'auth service', // Similar but not exact
      teamName: '',
      acronym: '',
      sourceId: 'component:default/auth-service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    // Should have a good score (Jaro-Winkler similarity)
    expect(result.score).toBeGreaterThan(70);
    expect(result.score).toBeLessThan(100);
    expect(result.scoreBreakdown.exactMatch).toBe(false);
    expect(result.scoreBreakdown.baseScore).toBeGreaterThan(70);
  });

  it('adds +10% bonus for team name match', () => {
    const pdService: NormalizedService = {
      rawName: 'Service A',
      normalizedName: 'service a',
      teamName: 'platform team',
      acronym: '',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'service-b', // Different name
      normalizedName: 'service b',
      teamName: 'platform team', // Same team
      acronym: '',
      sourceId: 'component:default/service-b',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.scoreBreakdown.teamMatch).toBe(true);
    // Base score + 10% bonus
    expect(result.score).toBeGreaterThan(result.scoreBreakdown.baseScore);
    expect(result.scoreBreakdown.rawScore).toBeCloseTo(
      result.scoreBreakdown.baseScore + 10,
      1,
    );
  });

  it('does not add team bonus if either team is empty', () => {
    const pdService: NormalizedService = {
      rawName: 'Service A',
      normalizedName: 'service a',
      teamName: '', // Empty team
      acronym: '',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'service-a',
      normalizedName: 'service a',
      teamName: 'platform team',
      acronym: '',
      sourceId: 'component:default/service-a',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.scoreBreakdown.teamMatch).toBe(false);
  });

  it('adds +5% bonus for acronym match', () => {
    const pdService: NormalizedService = {
      rawName: '[Platform] Auth Service',
      normalizedName: 'platform auth service',
      teamName: '',
      acronym: 'PAS',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'auth-system', // Different name
      normalizedName: 'auth system',
      teamName: '',
      acronym: 'PAS', // Same acronym
      sourceId: 'component:default/auth-system',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.scoreBreakdown.acronymMatch).toBe(true);
    // Should have +5% from acronym bonus
    expect(result.scoreBreakdown.rawScore).toBeCloseTo(
      result.scoreBreakdown.baseScore + 5,
      1,
    );
  });

  it('does not add acronym bonus if either acronym is empty', () => {
    const pdService: NormalizedService = {
      rawName: 'Service',
      normalizedName: 'service',
      teamName: '',
      acronym: '', // No acronym
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'service',
      normalizedName: 'service',
      teamName: '',
      acronym: 'SVC',
      sourceId: 'component:default/service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.scoreBreakdown.acronymMatch).toBe(false);
  });

  it('combines team and acronym bonuses', () => {
    const pdService: NormalizedService = {
      rawName: '[Platform] Database Service',
      normalizedName: 'platform database service',
      teamName: 'platform team',
      acronym: 'PDS',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'db-service',
      normalizedName: 'db service', // Different name
      teamName: 'platform team', // Same team (+10%)
      acronym: 'PDS', // Same acronym (+5%)
      sourceId: 'component:default/db-service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    expect(result.scoreBreakdown.teamMatch).toBe(true);
    expect(result.scoreBreakdown.acronymMatch).toBe(true);
    // Should have base + 10% + 5% = base + 15%
    expect(result.scoreBreakdown.rawScore).toBeCloseTo(
      result.scoreBreakdown.baseScore + 15,
      1,
    );
  });

  it('caps final score at 100%', () => {
    const pdService: NormalizedService = {
      rawName: 'Authentication Service',
      normalizedName: 'authentication service',
      teamName: 'platform team',
      acronym: 'AS',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'auth-service',
      normalizedName: 'auth service', // Very similar (~90% Jaro-Winkler)
      teamName: 'platform team', // +10%
      acronym: 'AS', // +5%
      sourceId: 'component:default/auth-service',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    // Even if raw score > 100, final should be capped at 100
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(100); // Should be capped at exactly 100
  });

  it('rounds scores to 2 decimal places', () => {
    const pdService: NormalizedService = {
      rawName: 'Test Service',
      normalizedName: 'test service',
      teamName: '',
      acronym: '',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'test-svc',
      normalizedName: 'test svc',
      teamName: '',
      acronym: '',
      sourceId: 'component:default/test-svc',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    // Score should have at most 2 decimal places
    expect(result.score).toBe(Math.round(result.score * 100) / 100);
    expect(result.scoreBreakdown.baseScore).toBe(
      Math.round(result.scoreBreakdown.baseScore * 100) / 100,
    );
  });

  it('returns low score for completely different names', () => {
    const pdService: NormalizedService = {
      rawName: 'Authentication Service',
      normalizedName: 'authentication service',
      teamName: '',
      acronym: '',
      sourceId: 'P123',
      source: 'pagerduty',
    };

    const bsComponent: NormalizedService = {
      rawName: 'payment-gateway',
      normalizedName: 'payment gateway', // Completely different
      teamName: '',
      acronym: '',
      sourceId: 'component:default/payment-gateway',
      source: 'backstage',
    };

    const result = calculateMatchScore(pdService, bsComponent);

    // Should have a low score (Jaro-Winkler may give some score for common words)
    expect(result.score).toBeLessThan(60);
    expect(result.scoreBreakdown.baseScore).toBeLessThan(60);
    expect(result.scoreBreakdown.exactMatch).toBe(false);
  });
});

describe('findMatches', () => {
  const pdServices: NormalizedService[] = [
    {
      rawName: 'Auth Service',
      normalizedName: 'auth service',
      teamName: 'platform team',
      acronym: 'AS',
      sourceId: 'P001',
      source: 'pagerduty',
    },
    {
      rawName: 'Payment Service',
      normalizedName: 'payment service',
      teamName: 'finance team',
      acronym: 'PS',
      sourceId: 'P002',
      source: 'pagerduty',
    },
    {
      rawName: 'No Match Service',
      normalizedName: 'no match service',
      teamName: '',
      acronym: '',
      sourceId: 'P003',
      source: 'pagerduty',
    },
  ];

  const bsComponents: NormalizedService[] = [
    {
      rawName: 'auth-service',
      normalizedName: 'auth service', // Exact match with P001
      teamName: 'platform team',
      acronym: 'AS',
      sourceId: 'component:default/auth-service',
      source: 'backstage',
    },
    {
      rawName: 'payment-gateway',
      normalizedName: 'payment gateway', // Similar to P002
      teamName: 'finance team',
      acronym: 'PG',
      sourceId: 'component:default/payment-gateway',
      source: 'backstage',
    },
    {
      rawName: 'totally-different',
      normalizedName: 'totally different', // No match
      teamName: '',
      acronym: '',
      sourceId: 'component:default/totally-different',
      source: 'backstage',
    },
  ];

  it('finds all matches above threshold', () => {
    const config: MatchingConfig = { threshold: 80 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Should find at least the exact match (P001 <-> auth-service)
    expect(matches.length).toBeGreaterThan(0);

    // All matches should be above threshold
    matches.forEach(match => {
      expect(match.score).toBeGreaterThanOrEqual(config.threshold);
    });
  });

  it('filters out matches below threshold', () => {
    const config: MatchingConfig = { threshold: 95 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Should only find very high confidence matches
    matches.forEach(match => {
      expect(match.score).toBeGreaterThanOrEqual(95);
    });
  });

  it('sorts matches by score (highest first)', () => {
    const config: MatchingConfig = { threshold: 0 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Verify matches are sorted descending
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].score).toBeLessThanOrEqual(matches[i - 1].score);
    }
  });

  it('returns empty array if no matches meet threshold', () => {
    const config: MatchingConfig = { threshold: 100 };
    const matches = findMatches(
      [pdServices[2]], // "No Match Service"
      [bsComponents[2]], // "totally-different"
      config,
    );

    expect(matches).toEqual([]);
  });

  it('handles empty input arrays', () => {
    const config: MatchingConfig = { threshold: 80 };

    const noServices = findMatches([], bsComponents, config);
    expect(noServices).toEqual([]);

    const noComponents = findMatches(pdServices, [], config);
    expect(noComponents).toEqual([]);

    const bothEmpty = findMatches([], [], config);
    expect(bothEmpty).toEqual([]);
  });

  it('returns all possible comparisons with low threshold', () => {
    const config: MatchingConfig = { threshold: 0 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Should have pdServices.length * bsComponents.length comparisons
    // But only those with score >= 0 (which should be all)
    expect(matches.length).toBeGreaterThan(0);
  });

  it('handles threshold of 100 (only exact matches)', () => {
    const config: MatchingConfig = { threshold: 100 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Should only find exact matches
    matches.forEach(match => {
      expect(match.score).toBe(100);
      expect(match.scoreBreakdown.exactMatch).toBe(true);
    });
  });
});

describe('groupMatchesByService', () => {
  it('groups matches by PagerDuty service ID', () => {
    const matches: MatchResult[] = [
      {
        pagerDutyService: {
          rawName: 'Service A',
          normalizedName: 'service a',
          teamName: '',
          acronym: '',
          sourceId: 'P001',
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-1',
          normalizedName: 'component 1',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-1',
          source: 'backstage',
        },
        score: 90,
        scoreBreakdown: {
          baseScore: 90,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 90,
        },
      },
      {
        pagerDutyService: {
          rawName: 'Service A',
          normalizedName: 'service a',
          teamName: '',
          acronym: '',
          sourceId: 'P001', // Same service
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-2',
          normalizedName: 'component 2',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-2',
          source: 'backstage',
        },
        score: 85,
        scoreBreakdown: {
          baseScore: 85,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 85,
        },
      },
    ];

    const grouped = groupMatchesByService(matches);

    expect(grouped.size).toBe(1);
    expect(grouped.has('P001')).toBe(true);
    expect(grouped.get('P001')?.length).toBe(2);
  });

  it('handles empty matches array', () => {
    const grouped = groupMatchesByService([]);
    expect(grouped.size).toBe(0);
  });
});

describe('filterToBestMatchPerService', () => {
  it('returns only the best match for each service', () => {
    const matches: MatchResult[] = [
      {
        pagerDutyService: {
          rawName: 'Service A',
          normalizedName: 'service a',
          teamName: '',
          acronym: '',
          sourceId: 'P001',
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-1',
          normalizedName: 'component 1',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-1',
          source: 'backstage',
        },
        score: 95, // Best match for P001
        scoreBreakdown: {
          baseScore: 95,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 95,
        },
      },
      {
        pagerDutyService: {
          rawName: 'Service A',
          normalizedName: 'service a',
          teamName: '',
          acronym: '',
          sourceId: 'P001', // Same service
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-2',
          normalizedName: 'component 2',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-2',
          source: 'backstage',
        },
        score: 85, // Lower score
        scoreBreakdown: {
          baseScore: 85,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 85,
        },
      },
      {
        pagerDutyService: {
          rawName: 'Service B',
          normalizedName: 'service b',
          teamName: '',
          acronym: '',
          sourceId: 'P002', // Different service
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-3',
          normalizedName: 'component 3',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-3',
          source: 'backstage',
        },
        score: 90,
        scoreBreakdown: {
          baseScore: 90,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 90,
        },
      },
    ];

    const filtered = filterToBestMatchPerService(matches);

    expect(filtered.length).toBe(2); // One for P001, one for P002
    expect(filtered[0].pagerDutyService.sourceId).toBe('P001');
    expect(filtered[0].score).toBe(95); // Best score for P001
    expect(filtered[1].pagerDutyService.sourceId).toBe('P002');
  });

  it('handles empty matches array', () => {
    const filtered = filterToBestMatchPerService([]);
    expect(filtered).toEqual([]);
  });

  it('maintains sorted order by score', () => {
    const matches: MatchResult[] = [
      {
        pagerDutyService: {
          rawName: 'Service A',
          normalizedName: 'service a',
          teamName: '',
          acronym: '',
          sourceId: 'P001',
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-1',
          normalizedName: 'component 1',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-1',
          source: 'backstage',
        },
        score: 80,
        scoreBreakdown: {
          baseScore: 80,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 80,
        },
      },
      {
        pagerDutyService: {
          rawName: 'Service B',
          normalizedName: 'service b',
          teamName: '',
          acronym: '',
          sourceId: 'P002',
          source: 'pagerduty',
        },
        backstageComponent: {
          rawName: 'component-2',
          normalizedName: 'component 2',
          teamName: '',
          acronym: '',
          sourceId: 'component:default/component-2',
          source: 'backstage',
        },
        score: 95,
        scoreBreakdown: {
          baseScore: 95,
          exactMatch: false,
          teamMatch: false,
          acronymMatch: false,
          rawScore: 95,
        },
      },
    ];

    const filtered = filterToBestMatchPerService(matches);

    // Should be sorted by score descending
    expect(filtered[0].score).toBeGreaterThanOrEqual(filtered[1].score);
  });
});

describe('integration: realistic scenarios', () => {
  it('handles realistic PagerDuty and Backstage data', () => {
    const pdServices: NormalizedService[] = [
      {
        rawName: '[Platform] Authentication Service (on-call)',
        normalizedName: 'platform authentication service',
        teamName: 'platform team',
        acronym: 'PAS',
        sourceId: 'PABC123',
        source: 'pagerduty',
      },
      {
        rawName: 'Payment_Gateway_API',
        normalizedName: 'payment gateway api',
        teamName: 'payments team',
        acronym: 'PGA',
        sourceId: 'PXYZ789',
        source: 'pagerduty',
      },
    ];

    const bsComponents: NormalizedService[] = [
      {
        rawName: 'platform-auth-service',
        normalizedName: 'platform auth service',
        teamName: 'platform team',
        acronym: 'PAS',
        sourceId: 'component:default/platform-auth-service',
        source: 'backstage',
      },
      {
        rawName: 'payment-gateway-api',
        normalizedName: 'payment gateway api',
        teamName: 'payments team',
        acronym: 'PGA',
        sourceId: 'component:default/payment-gateway-api',
        source: 'backstage',
      },
    ];

    const config: MatchingConfig = { threshold: 80 };
    const matches = findMatches(pdServices, bsComponents, config);

    // Should find both matches
    expect(matches.length).toBeGreaterThanOrEqual(2);

    // Payment Gateway should be 100% match
    const paymentMatch = matches.find(
      m => m.pagerDutyService.sourceId === 'PXYZ789',
    );
    expect(paymentMatch).toBeDefined();
    expect(paymentMatch!.score).toBe(100);
    expect(paymentMatch!.scoreBreakdown.exactMatch).toBe(true);

    // Auth service should be high score (team + acronym match, similar names)
    const authMatch = matches.find(
      m => m.pagerDutyService.sourceId === 'PABC123',
    );
    expect(authMatch).toBeDefined();
    expect(authMatch!.score).toBeGreaterThan(90);
  });

  it('handles large dataset performance', () => {
    // Generate 100 PD services and 100 BS components with similar names
    const pdServices: NormalizedService[] = Array.from({ length: 100 }, (_, i) => ({
      rawName: `Service ${i}`,
      normalizedName: `api service ${i}`, // More similar to component names
      teamName: `team ${i % 10}`,
      acronym: `AS${i}`,
      sourceId: `P${i.toString().padStart(3, '0')}`,
      source: 'pagerduty' as const,
    }));

    const bsComponents: NormalizedService[] = Array.from({ length: 100 }, (_, i) => ({
      rawName: `component-${i}`,
      normalizedName: `api service ${i}`, // Same normalized name for exact matches
      teamName: `team ${i % 10}`,
      acronym: `AS${i}`,
      sourceId: `component:default/component-${i}`,
      source: 'backstage' as const,
    }));

    const config: MatchingConfig = { threshold: 80 };

    const startTime = Date.now();
    const matches = findMatches(pdServices, bsComponents, config);
    const endTime = Date.now();

    // Should complete in reasonable time (< 5 seconds for 10k comparisons)
    expect(endTime - startTime).toBeLessThan(5000);

    // Should find matches (exact matches with 100% score)
    expect(matches.length).toBeGreaterThan(0);

    // Each service should have at least one exact match
    expect(matches.length).toBeGreaterThanOrEqual(100);
  });
});
