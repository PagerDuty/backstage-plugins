import { Request, Response } from 'express';
import { CatalogApi } from '@backstage/catalog-client';
import { PagerDutyService } from '@pagerduty/backstage-plugin-common';
import { PagerDutyBackendStore, RawDbEntityResultRow } from '../db/PagerDutyBackendDatabase';
import { getMappingEntities } from './mappings-controller';
import * as PagerdutyApi from '../apis/pagerduty';

jest.mock('../services/pagerduty', () => ({
  getServicesIdsByPartialName: jest.fn(),
}));

jest.mock('../apis/pagerduty', () => ({
  ...jest.requireActual('../apis/pagerduty'),
  getServicesByIds: jest.fn(),
  getServiceByIntegrationKey: jest.fn(),
}));

const MALFORMED_SERVICE_ID =
  'https://acme.pagerduty.com/service-directory/PBAD';

function buildService(id: string): PagerDutyService {
  return {
    id,
    name: `Service ${id}`,
    html_url: `https://acme.pagerduty.com/services/${id}`,
    escalation_policy: {
      id: 'P0L1CY1D',
      name: 'Test Escalation Policy',
      html_url: 'https://acme.pagerduty.com/escalation_policies/P0L1CY1D',
      type: 'escalation_policy_reference',
    },
    status: 'active',
  } as PagerDutyService;
}

function buildEntity(name: string, serviceId: string) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'default',
      uid: `uid-${name}`,
      annotations: {
        'pagerduty.com/service-id': serviceId,
      },
    },
    spec: { owner: 'team-a' },
  };
}

function buildResponse() {
  const response = {} as Response;
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
}

function buildRequest(body: unknown): Request {
  return { body } as Request;
}

describe('getMappingEntities', () => {
  const getServicesByIds = PagerdutyApi.getServicesByIds as jest.Mock;
  const logger = { warn: jest.fn() } as any;

  let store: PagerDutyBackendStore;
  let catalogApi: CatalogApi;

  beforeEach(() => {
    jest.clearAllMocks();

    store = {
      getAllEntityMappings: jest.fn().mockResolvedValue([] as RawDbEntityResultRow[]),
    } as unknown as PagerDutyBackendStore;

    catalogApi = {
      queryEntities: jest.fn(),
    } as unknown as CatalogApi;
  });

  it('does not 400 when an entity carries a malformed service-id annotation and the status filter is set', async () => {
    (catalogApi.queryEntities as jest.Mock).mockResolvedValue({
      items: [buildEntity('bad-component', MALFORMED_SERVICE_ID)],
      totalItems: 1,
      pageInfo: {},
    });
    getServicesByIds.mockResolvedValue([]);

    const handler = getMappingEntities(store, catalogApi, logger);
    const response = buildResponse();

    await handler(
      buildRequest({ offset: 0, limit: 10, filters: { status: 'OutOfSync' } }),
      response,
    );

    // The malformed id must never reach the PagerDuty batch call.
    expect(getServicesByIds).toHaveBeenCalledTimes(1);
    expect(getServicesByIds.mock.calls[0][0]).not.toContain(MALFORMED_SERVICE_ID);

    // And the request resolves successfully rather than returning a 400.
    expect(response.status).not.toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ entities: expect.any(Array), totalCount: expect.any(Number) }),
    );
  });

  it('logs a warning naming the malformed service id', async () => {
    (catalogApi.queryEntities as jest.Mock).mockResolvedValue({
      items: [buildEntity('bad-component', MALFORMED_SERVICE_ID)],
      totalItems: 1,
      pageInfo: {},
    });
    getServicesByIds.mockResolvedValue([]);

    const handler = getMappingEntities(store, catalogApi, logger);

    await handler(
      buildRequest({ offset: 0, limit: 10, filters: { status: 'OutOfSync' } }),
      buildResponse(),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(MALFORMED_SERVICE_ID),
    );
  });

  it('forwards a valid service-id annotation to getServicesByIds and populates service fields', async () => {
    (catalogApi.queryEntities as jest.Mock).mockResolvedValue({
      items: [buildEntity('good-component', 'PVALID1')],
      totalItems: 1,
      pageInfo: {},
    });
    getServicesByIds.mockResolvedValue([buildService('PVALID1')]);

    const handler = getMappingEntities(store, catalogApi, logger);
    const response = buildResponse();

    await handler(
      buildRequest({ offset: 0, limit: 10, filters: {} }),
      response,
    );

    expect(getServicesByIds.mock.calls[0][0]).toContain('PVALID1');
    expect(logger.warn).not.toHaveBeenCalled();

    const payload = (response.json as jest.Mock).mock.calls[0][0];
    expect(payload.entities[0].serviceName).toBe('Service PVALID1');
    expect(payload.entities[0].serviceUrl).toBe(
      'https://acme.pagerduty.com/services/PVALID1',
    );
  });

  it('returns normally with no status filter regardless of annotation validity', async () => {
    (catalogApi.queryEntities as jest.Mock).mockResolvedValue({
      items: [buildEntity('bad-component', MALFORMED_SERVICE_ID)],
      totalItems: 1,
      pageInfo: {},
    });
    getServicesByIds.mockResolvedValue([]);

    const handler = getMappingEntities(store, catalogApi, logger);
    const response = buildResponse();

    await handler(buildRequest({ offset: 0, limit: 10, filters: {} }), response);

    expect(response.status).not.toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ entities: expect.any(Array) }),
    );
  });
});
