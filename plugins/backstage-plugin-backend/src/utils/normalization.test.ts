/**
 * Unit tests for string normalization utilities
 *
 * @group unit/utils/normalization
 */

import {
  normalizeName,
  preprocessForMatching,
  extractAcronym,
  normalizeService,
  type NormalizedService,
} from './normalization';

describe('normalizeName', () => {
  describe('basic transformations', () => {
    it('converts to lowercase', () => {
      expect(normalizeName('MyService')).toBe('myservice');
      expect(normalizeName('UPPERCASE')).toBe('uppercase');
      expect(normalizeName('MiXeDCaSe')).toBe('mixedcase');
    });

    it('replaces underscores with spaces', () => {
      expect(normalizeName('my_service')).toBe('my service');
      expect(normalizeName('my_service_name')).toBe('my service name');
      expect(normalizeName('multiple___underscores')).toBe(
        'multiple underscores', // Multiple underscores → spaces → collapsed
      );
    });

    it('replaces hyphens with spaces', () => {
      expect(normalizeName('my-service')).toBe('my service');
      expect(normalizeName('my-service-name')).toBe('my service name');
      expect(normalizeName('multiple---hyphens')).toBe('multiple hyphens'); // Multiple hyphens → spaces → collapsed
    });

    it('collapses multiple whitespaces', () => {
      expect(normalizeName('my   service')).toBe('my service');
      expect(normalizeName('lots    of     spaces')).toBe('lots of spaces');
      expect(normalizeName('tab\t\tspaces')).toBe('tab spaces');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeName('  my service  ')).toBe('my service');
      expect(normalizeName('\t\nmy service\n\t')).toBe('my service');
      expect(normalizeName('   leading')).toBe('leading');
      expect(normalizeName('trailing   ')).toBe('trailing');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeName('')).toBe('');
    });

    it('handles string with only whitespace', () => {
      expect(normalizeName('   ')).toBe('');
      expect(normalizeName('\t\n\r')).toBe('');
    });

    it('handles string with only separators', () => {
      expect(normalizeName('___')).toBe('');
      expect(normalizeName('---')).toBe('');
      expect(normalizeName('_-_-_')).toBe('');
    });

    it('handles special characters', () => {
      expect(normalizeName('service@api')).toBe('service@api');
      expect(normalizeName('service.api')).toBe('service.api');
      expect(normalizeName('service/api')).toBe('service/api');
    });

    it('handles numbers', () => {
      expect(normalizeName('Service123')).toBe('service123');
      expect(normalizeName('API_V2')).toBe('api v2');
    });
  });

  describe('real-world examples', () => {
    it('normalizes typical service names', () => {
      expect(normalizeName('My_Service-Name   API')).toBe(
        'my service name api',
      );
      expect(normalizeName('Auth_Service')).toBe('auth service');
      expect(normalizeName('payment-gateway')).toBe('payment gateway');
    });

    it('normalizes PagerDuty service names', () => {
      expect(normalizeName('#2 Jira Cloud')).toBe('#2 jira cloud');
      expect(normalizeName('Postman/Webhook Incoming')).toBe(
        'postman/webhook incoming',
      );
      expect(normalizeName('Oauth Demo')).toBe('oauth demo');
    });
  });
});

describe('preprocessForMatching', () => {
  describe('prefix and suffix removal', () => {
    it('removes prefix tags', () => {
      expect(preprocessForMatching('[Platform] Auth Service')).toBe(
        'auth-service',
      );
      expect(preprocessForMatching('[Team-A] Payment API')).toBe('payment-api');
      expect(preprocessForMatching('[SRE] Monitoring')).toBe('monitoring');
      expect(preprocessForMatching('[Team Name] Service')).toBe('service');
    });

    it('removes suffix notes', () => {
      expect(preprocessForMatching('Service (on-call)')).toBe('service');
      expect(preprocessForMatching('API (deprecated)')).toBe('api');
      expect(preprocessForMatching('Gateway (v2)')).toBe('gateway');
      expect(preprocessForMatching('Service (production)')).toBe('service');
    });

    it('removes both prefix and suffix', () => {
      expect(preprocessForMatching('[Team] Service (on-call)')).toBe('service');
      expect(preprocessForMatching('[SRE] API (deprecated)')).toBe('api');
    });
  });

  describe('word preservation', () => {
    it('preserves all meaningful words', () => {
      expect(preprocessForMatching('API Gateway Endpoints')).toBe(
        'api-gateway-endpoints',
      );
      expect(preprocessForMatching('Auth Service Web')).toBe(
        'auth-service-web',
      );
      expect(preprocessForMatching('Payment On-Call')).toBe('payment-on-call');
      expect(preprocessForMatching('Web API Gateway')).toBe('web-api-gateway');
    });

    it('preserves repo markers', () => {
      expect(preprocessForMatching('My Service - open source repo')).toBe(
        'my-service-open-source-repo',
      );
      expect(
        preprocessForMatching('Auth API - Open Source Repo'),
      ).toBe('auth-api-open-source-repo');
    });
  });

  describe('normalization', () => {
    it('converts to hyphenated lowercase', () => {
      expect(preprocessForMatching('My Service API')).toBe('my-service-api');
      expect(preprocessForMatching('AuthServiceGateway')).toBe(
        'authservicegateway',
      );
    });

    it('replaces underscores with hyphens', () => {
      expect(preprocessForMatching('my_service_api')).toBe('my-service-api');
      expect(preprocessForMatching('auth_gateway')).toBe('auth-gateway');
    });

    it('replaces spaces with hyphens', () => {
      expect(preprocessForMatching('my service api')).toBe('my-service-api');
      expect(preprocessForMatching('auth   gateway')).toBe('auth-gateway');
    });

    it('collapses multiple hyphens', () => {
      expect(preprocessForMatching('my---service')).toBe('my-service');
      expect(preprocessForMatching('auth--gateway')).toBe('auth-gateway');
    });

    it('trims leading and trailing hyphens', () => {
      expect(preprocessForMatching('-my-service-')).toBe('my-service');
      expect(preprocessForMatching('---service---')).toBe('service');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(preprocessForMatching('')).toBe('');
    });

    it('handles string with only whitespace', () => {
      expect(preprocessForMatching('   ')).toBe('');
    });

    it('handles string that becomes empty after processing', () => {
      expect(preprocessForMatching('[Team]')).toBe('');
      expect(preprocessForMatching('(notes)')).toBe('');
      expect(preprocessForMatching('[Team] (notes)')).toBe('');
    });

    it('handles special characters', () => {
      expect(preprocessForMatching('service@api')).toBe('service@api');
      expect(preprocessForMatching('service.com')).toBe('service.com');
    });
  });

  describe('real-world examples', () => {
    it('handles complex PagerDuty service names', () => {
      expect(
        preprocessForMatching('[Platform] Auth_Service (on-call) - Endpoints'),
      ).toBe('auth-service-endpoints'); // (on-call) removed by parentheses removal

      expect(preprocessForMatching('[SRE] API Gateway Web')).toBe(
        'api-gateway-web',
      );

      expect(
        preprocessForMatching('Payment Service - open source repo'),
      ).toBe('payment-service-open-source-repo');
    });

    it('handles typical Backstage entity names', () => {
      expect(preprocessForMatching('#2 Jira Cloud')).toBe('2-jira-cloud');
      expect(preprocessForMatching('Postman/Webhook Incoming')).toBe(
        'postman/webhook-incoming',
      );
      expect(preprocessForMatching('Oauth Demo')).toBe('oauth-demo');
    });
  });
});

describe('extractAcronym', () => {
  describe('CamelCase pattern', () => {
    it('extracts from CamelCase', () => {
      expect(extractAcronym('MyServiceAPI')).toBe('MSA'); // My, Service, API → M, S, A
      expect(extractAcronym('AuthService')).toBe('AS');
      expect(extractAcronym('PaymentGateway')).toBe('PG');
    });

    it('handles consecutive capitals', () => {
      expect(extractAcronym('APIGatewayService')).toBe('AGS'); // API, Gateway, Service → A, G, S
      expect(extractAcronym('HTTPSProxy')).toBe('HP'); // HTTPS, Proxy → H, P
    });

    it('handles single capital', () => {
      expect(extractAcronym('Service')).toBe('S');
      expect(extractAcronym('API')).toBe('API'); // All caps, <=5 chars → return as-is
    });
  });

  describe('space-separated pattern', () => {
    it('extracts from space-separated words', () => {
      expect(extractAcronym('My Service API')).toBe('MSA'); // Takes first letter of each word
      expect(extractAcronym('Auth Service')).toBe('AS');
      expect(extractAcronym('Payment Gateway')).toBe('PG');
    });

    it('handles mixed case words', () => {
      expect(extractAcronym('my service api')).toBe('MSA');
      expect(extractAcronym('Auth service')).toBe('AS');
    });

    it('handles single word', () => {
      expect(extractAcronym('Service')).toBe('S');
    });
  });

  describe('separator patterns', () => {
    it('extracts from hyphen-separated', () => {
      expect(extractAcronym('my-service-api')).toBe('MSA');
      expect(extractAcronym('auth-gateway')).toBe('AG');
    });

    it('extracts from underscore-separated', () => {
      expect(extractAcronym('my_service_api')).toBe('MSA');
      expect(extractAcronym('auth_gateway')).toBe('AG');
    });

    it('handles mixed separators', () => {
      expect(extractAcronym('my-service_API')).toBe('MSA');
      expect(extractAcronym('auth_gateway-service')).toBe('AGS');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(extractAcronym('')).toBe('');
    });

    it('handles single character', () => {
      expect(extractAcronym('a')).toBe('A');
      expect(extractAcronym('A')).toBe('A');
    });

    it('handles string with only separators', () => {
      expect(extractAcronym('---')).toBe('');
      expect(extractAcronym('___')).toBe('');
    });

    it('handles numbers', () => {
      expect(extractAcronym('Service123')).toBe('S');
      expect(extractAcronym('API V2')).toBe('AV'); // API (already an acronym), V, 2 → A, V
      expect(extractAcronym('v2-api-gateway')).toBe('VAG');
    });
  });

  describe('real-world examples', () => {
    it('extracts from typical service names', () => {
      expect(extractAcronym('API Gateway Service')).toBe('AGS'); // First letter of each word
      expect(extractAcronym('AuthenticationService')).toBe('AS'); // CamelCase: A + S
      expect(extractAcronym('payment-processing-api')).toBe('PPA');
    });

    it('handles all-caps abbreviations', () => {
      expect(extractAcronym('API')).toBe('API'); // All caps, <=5 chars → return as-is
      expect(extractAcronym('HTTP Gateway')).toBe('HG'); // First letter of each word
      expect(extractAcronym('HTTPS_PROXY')).toBe('HP'); // HTTPS all caps,  treat as one word
    });
  });
});

describe('normalizeService', () => {
  describe('basic normalization mode', () => {
    it('creates NormalizedService with basic normalization', () => {
      const result = normalizeService(
        'My_Service-Name',
        'Platform Team',
        'P123',
        'pagerduty',
        false,
      );

      expect(result).toEqual({
        rawName: 'My_Service-Name',
        normalizedName: 'my service name',
        teamName: 'platform team',
        acronym: 'MSN',
        sourceId: 'P123',
        source: 'pagerduty',
      });
    });

    it('preserves original name', () => {
      const result = normalizeService(
        '[Team] Special_Service',
        'Team A',
        'B456',
        'backstage',
        false,
      );

      expect(result.rawName).toBe('[Team] Special_Service');
      expect(result.normalizedName).toBe('[team] special service');
    });
  });

  describe('advanced preprocessing mode', () => {
    it('creates NormalizedService with advanced preprocessing', () => {
      const result = normalizeService(
        '[Platform] Auth Service (on-call)',
        'Platform Team',
        'P456',
        'pagerduty',
        true,
      );

      expect(result).toMatchObject({
        rawName: '[Platform] Auth Service (on-call)',
        normalizedName: 'auth-service',
        teamName: 'platform-team',
        // acronym extracted from original name
        sourceId: 'P456',
        source: 'pagerduty',
      });
    });

    it('preserves meaningful words while removing structural markers', () => {
      const result = normalizeService(
        '[SRE] API Gateway Endpoints',
        'SRE Team (on-call)',
        'P789',
        'pagerduty',
        true,
      );

      expect(result.normalizedName).toBe('api-gateway-endpoints'); // Preserves "endpoints"
      expect(result.teamName).toBe('sre-team'); // Removes (on-call) parenthetical
    });
  });

  describe('source tracking', () => {
    it('tracks PagerDuty source', () => {
      const result = normalizeService(
        'Service',
        'Team',
        'PD123',
        'pagerduty',
        false,
      );

      expect(result.source).toBe('pagerduty');
      expect(result.sourceId).toBe('PD123');
    });

    it('tracks Backstage source', () => {
      const result = normalizeService(
        'Service',
        'Team',
        'component:default/service',
        'backstage',
        false,
      );

      expect(result.source).toBe('backstage');
      expect(result.sourceId).toBe('component:default/service');
    });
  });

  describe('edge cases', () => {
    it('handles empty strings', () => {
      const result = normalizeService('', '', '', 'pagerduty', false);

      expect(result).toEqual({
        rawName: '',
        normalizedName: '',
        teamName: '',
        acronym: '',
        sourceId: '',
        source: 'pagerduty',
      });
    });

    it('handles service with no team', () => {
      const result = normalizeService(
        'Orphan Service',
        '',
        'P999',
        'pagerduty',
        false,
      );

      expect(result.teamName).toBe('');
      expect(result.normalizedName).toBe('orphan service');
    });
  });

  describe('real-world examples', () => {
    it('normalizes actual PagerDuty service', () => {
      const result = normalizeService(
        '#2 Jira Cloud',
        'Integration Team',
        'P4H6SXP',
        'pagerduty',
        true,
      );

      expect(result).toMatchObject({
        rawName: '#2 Jira Cloud',
        normalizedName: '2-jira-cloud',
        teamName: 'integration-team',
        sourceId: 'P4H6SXP',
        source: 'pagerduty',
      });
    });

    it('normalizes actual Backstage entity', () => {
      const result = normalizeService(
        'jira-cloud-service',
        'platform-team',
        'component:default/jira-cloud-service',
        'backstage',
        true,
      );

      expect(result).toMatchObject({
        rawName: 'jira-cloud-service',
        normalizedName: 'jira-cloud-service',
        teamName: 'platform-team',
        sourceId: 'component:default/jira-cloud-service',
        source: 'backstage',
      });
    });
  });
});

describe('type safety', () => {
  it('NormalizedService interface enforces correct structure', () => {
    const service: NormalizedService = {
      rawName: 'Test',
      normalizedName: 'test',
      teamName: 'team',
      acronym: 'T',
      sourceId: '123',
      source: 'pagerduty',
    };

    expect(service).toBeDefined();
  });

  it('source field only accepts valid values', () => {
    const pdService: NormalizedService = normalizeService(
      'Test',
      'Team',
      '1',
      'pagerduty',
      false,
    );
    expect(pdService.source).toBe('pagerduty');

    const bsService: NormalizedService = normalizeService(
      'Test',
      'Team',
      '2',
      'backstage',
      false,
    );
    expect(bsService.source).toBe('backstage');
  });
});
