/**
 * Unit tests for Data Loader Module
 *
 * @group unit/services/dataLoader
 */

import {
  loadPagerDutyServices,
  loadBackstageComponents,
  loadBothSources,
  type DataLoaderContext,
} from './dataLoader';
import { getAllServices } from '../apis/pagerduty';
import type { PagerDutyService } from '@pagerduty/backstage-plugin-common';
import type { CatalogApi } from '@backstage/catalog-client';
import type { Entity } from '@backstage/catalog-model';

// Mock the dependencies
jest.mock('../apis/pagerduty');
jest.mock('../utils/normalization', () => {
  const actual = jest.requireActual('../utils/normalization');
  return {
    ...actual,
    normalizeService: jest.fn(actual.normalizeService),
  };
});

const mockedGetAllServices = jest.mocked(getAllServices);

describe('loadPagerDutyServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully loads and normalizes PagerDuty services', async () => {
    // Mock PagerDuty API response
    const mockServices: PagerDutyService[] = [
      {
        id: 'P123ABC',
        name: '[Platform] Auth Service (on-call)',
        html_url: 'https://test.pagerduty.com/services/P123ABC',
        escalation_policy: {
          id: 'EP123',
          name: 'Default Escalation',
        },
        teams: [
          {
            id: 'T123',
            name: 'Platform Team',
            summary: 'Platform Team',
          },
        ],
      },
      {
        id: 'P456DEF',
        name: 'Payment Gateway',
        html_url: 'https://test.pagerduty.com/services/P456DEF',
        escalation_policy: {
          id: 'EP456',
          name: 'Payment Escalation',
        },
        teams: [
          {
            id: 'T456',
            name: 'Payments Team',
            summary: 'Payments Team',
          },
        ],
      },
    ];

    mockedGetAllServices.mockResolvedValue(mockServices);

    const result = await loadPagerDutyServices();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rawName: '[Platform] Auth Service (on-call)',
      sourceId: 'P123ABC',
      source: 'pagerduty',
    });
    expect(result[1]).toMatchObject({
      rawName: 'Payment Gateway',
      sourceId: 'P456DEF',
      source: 'pagerduty',
    });
  });

  it('handles services without teams', async () => {
    const mockServices: PagerDutyService[] = [
      {
        id: 'P789',
        name: 'Orphan Service',
        html_url: 'https://test.pagerduty.com/services/P789',
        escalation_policy: {
          id: 'EP789',
          name: 'Default',
        },
        // No teams array
      },
    ];

    mockedGetAllServices.mockResolvedValue(mockServices);

    const result = await loadPagerDutyServices();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rawName: 'Orphan Service',
      teamName: '', // Should default to empty string
      sourceId: 'P789',
      source: 'pagerduty',
    });
  });

  it('handles services with empty teams array', async () => {
    const mockServices: PagerDutyService[] = [
      {
        id: 'P999',
        name: 'No Team Service',
        html_url: 'https://test.pagerduty.com/services/P999',
        escalation_policy: {
          id: 'EP999',
          name: 'Default',
        },
        teams: [], // Empty array
      },
    ];

    mockedGetAllServices.mockResolvedValue(mockServices);

    const result = await loadPagerDutyServices();

    expect(result).toHaveLength(1);
    expect(result[0].teamName).toBe('');
  });

  it('applies basic normalization', async () => {
    const mockServices: PagerDutyService[] = [
      {
        id: 'P111',
        name: 'Test_Service-Name',
        html_url: 'https://test.pagerduty.com/services/P111',
        escalation_policy: {
          id: 'EP111',
          name: 'Default',
        },
        teams: [
          {
            id: 'T111',
            name: 'Test_Team',
            summary: 'Test_Team',
          },
        ],
      },
    ];

    mockedGetAllServices.mockResolvedValue(mockServices);

    const result = await loadPagerDutyServices();

    // Basic normalization converts underscores/hyphens to spaces
    expect(result[0].normalizedName).toBe('test service name');
    expect(result[0].teamName).toBe('test team');
  });

  it('throws error when getAllServices fails', async () => {
    mockedGetAllServices.mockRejectedValue(
      new Error('PagerDuty API error'),
    );

    await expect(loadPagerDutyServices()).rejects.toThrow(
      'Failed to load PagerDuty services',
    );
  });

  it('handles large number of services', async () => {
    // Generate 686 mock services (typical staging environment)
    const mockServices: PagerDutyService[] = Array.from(
      { length: 686 },
      (_, i) => ({
        id: `P${i}`,
        name: `Service ${i}`,
        html_url: `https://test.pagerduty.com/services/P${i}`,
        escalation_policy: {
          id: `EP${i}`,
          name: 'Default',
        },
        teams: [
          {
            id: `T${i}`,
            name: `Team ${i}`,
            summary: `Team ${i}`,
          },
        ],
      }),
    );

    mockedGetAllServices.mockResolvedValue(mockServices);

    const result = await loadPagerDutyServices();

    expect(result).toHaveLength(686);
    expect(result[0].source).toBe('pagerduty');
    expect(result[685].source).toBe('pagerduty');
  });
});

describe('loadBackstageComponents', () => {
  let mockCatalogApi: jest.Mocked<CatalogApi>;
  let context: DataLoaderContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCatalogApi = {
      getEntities: jest.fn(),
    } as unknown as jest.Mocked<CatalogApi>;

    context = {
      catalogApi: mockCatalogApi,
    };
  });

  it('successfully loads and normalizes Backstage components', async () => {
    const mockEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'auth-service',
          namespace: 'default',
        },
        spec: {
          type: 'service',
          owner: 'team-platform',
          lifecycle: 'production',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'payment-gateway',
          namespace: 'default',
        },
        spec: {
          type: 'service',
          owner: 'team-payments',
          lifecycle: 'production',
        },
      },
    ];

    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockEntities,
    });

    const result = await loadBackstageComponents(context);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rawName: 'auth-service',
      sourceId: 'component:default/auth-service',
      source: 'backstage',
    });
    expect(result[1]).toMatchObject({
      rawName: 'payment-gateway',
      sourceId: 'component:default/payment-gateway',
      source: 'backstage',
    });

    expect(mockCatalogApi.getEntities).toHaveBeenCalledWith({
      filter: {
        kind: 'Component',
      },
    });
  });

  it('handles components without owners', async () => {
    const mockEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'orphan-component',
          namespace: 'default',
        },
        spec: {
          type: 'service',
          lifecycle: 'experimental',
          // No owner
        },
      },
    ];

    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockEntities,
    });

    const result = await loadBackstageComponents(context);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rawName: 'orphan-component',
      teamName: '', // Should default to empty string
      sourceId: 'component:default/orphan-component',
      source: 'backstage',
    });
  });

  it('creates correct entity reference format', async () => {
    const mockEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'Test-Service',
          namespace: 'Production',
        },
        spec: {
          type: 'service',
          owner: 'team-ops',
        },
      },
    ];

    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockEntities,
    });

    const result = await loadBackstageComponents(context);

    // Entity ref should be lowercase: kind:namespace/name
    expect(result[0].sourceId).toBe('component:production/test-service');
  });

  it('applies basic normalization', async () => {
    const mockEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test_service-name',
          namespace: 'default',
        },
        spec: {
          type: 'service',
          owner: 'team_platform',
        },
      },
    ];

    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockEntities,
    });

    const result = await loadBackstageComponents(context);

    // Basic normalization converts underscores/hyphens to spaces
    expect(result[0].normalizedName).toBe('test service name');
    expect(result[0].teamName).toBe('team platform');
  });

  it('throws error when catalog API fails', async () => {
    mockCatalogApi.getEntities.mockRejectedValue(
      new Error('Catalog API error'),
    );

    await expect(loadBackstageComponents(context)).rejects.toThrow(
      'Failed to load Backstage components',
    );
  });

  it('handles large number of components', async () => {
    // Generate 1000 mock components
    const mockEntities: Entity[] = Array.from({ length: 1000 }, (_, i) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `component-${i}`,
        namespace: 'default',
      },
      spec: {
        type: 'service',
        owner: `team-${i % 10}`, // 10 different teams
      },
    }));

    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockEntities,
    });

    const result = await loadBackstageComponents(context);

    expect(result).toHaveLength(1000);
    expect(result[0].source).toBe('backstage');
    expect(result[999].source).toBe('backstage');
  });
});

describe('loadBothSources', () => {
  let mockCatalogApi: jest.Mocked<CatalogApi>;
  let context: DataLoaderContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCatalogApi = {
      getEntities: jest.fn(),
    } as unknown as jest.Mocked<CatalogApi>;

    context = {
      catalogApi: mockCatalogApi,
    };
  });

  it('loads both sources in parallel', async () => {
    // Mock PagerDuty services
    const mockPDServices: PagerDutyService[] = [
      {
        id: 'P1',
        name: 'PD Service 1',
        html_url: 'https://test.pagerduty.com/services/P1',
        escalation_policy: { id: 'EP1', name: 'Default' },
      },
    ];

    // Mock Backstage components
    const mockBSEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'bs-component-1', namespace: 'default' },
        spec: { type: 'service', owner: 'team-a' },
      },
    ];

    mockedGetAllServices.mockResolvedValue(mockPDServices);
    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockBSEntities,
    });

    const result = await loadBothSources(context);

    expect(result.pdServices).toHaveLength(1);
    expect(result.bsComponents).toHaveLength(1);
    expect(result.pdServices[0].source).toBe('pagerduty');
    expect(result.bsComponents[0].source).toBe('backstage');
  });

  it('returns correct structure', async () => {
    mockedGetAllServices.mockResolvedValue([]);
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });

    const result = await loadBothSources(context);

    expect(result).toHaveProperty('pdServices');
    expect(result).toHaveProperty('bsComponents');
    expect(Array.isArray(result.pdServices)).toBe(true);
    expect(Array.isArray(result.bsComponents)).toBe(true);
  });

  it('handles empty results from both sources', async () => {
    mockedGetAllServices.mockResolvedValue([]);
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });

    const result = await loadBothSources(context);

    expect(result.pdServices).toHaveLength(0);
    expect(result.bsComponents).toHaveLength(0);
  });

  it('throws ServiceLoadError if PagerDuty loading fails', async () => {
    mockedGetAllServices.mockRejectedValue(new Error('PD error'));
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });

    await expect(loadBothSources(context)).rejects.toThrow(
      'Failed to load PagerDuty services',
    );
  });

  it('throws ServiceLoadError if Backstage loading fails', async () => {
    mockedGetAllServices.mockResolvedValue([]);
    mockCatalogApi.getEntities.mockRejectedValue(new Error('BS error'));

    await expect(loadBothSources(context)).rejects.toThrow(
      'Failed to load Backstage components',
    );
  });

  it('handles realistic dataset sizes', async () => {
    // Mock 686 PD services
    const mockPDServices: PagerDutyService[] = Array.from(
      { length: 686 },
      (_, i) => ({
        id: `P${i}`,
        name: `Service ${i}`,
        html_url: `https://test.pagerduty.com/services/P${i}`,
        escalation_policy: { id: `EP${i}`, name: 'Default' },
      }),
    );

    // Mock 1000 BS components
    const mockBSEntities: Entity[] = Array.from({ length: 1000 }, (_, i) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: `component-${i}`, namespace: 'default' },
      spec: { type: 'service', owner: 'team-a' },
    }));

    mockedGetAllServices.mockResolvedValue(mockPDServices);
    mockCatalogApi.getEntities.mockResolvedValue({
      items: mockBSEntities,
    });

    const result = await loadBothSources(context);

    expect(result.pdServices).toHaveLength(686);
    expect(result.bsComponents).toHaveLength(1000);

    // Total possible comparisons
    const totalComparisons =
      result.pdServices.length * result.bsComponents.length;
    expect(totalComparisons).toBe(686000);
  });
});
