import express from 'express';
import request from 'supertest';

import {
  createRouter,
  buildEntityMappingsResponse,
} from './router';
import {
  PagerDutyEscalationPolicy,
  PagerDutyService,
  PagerDutyServiceResponse,
  PagerDutyOnCallUsersResponse,
  PagerDutyChangeEventsResponse,
  PagerDutyChangeEvent,
  PagerDutyIncidentsResponse,
  PagerDutyIncident,
  PagerDutyServiceStandardsResponse,
  PagerDutyServiceMetricsResponse,
  PagerDutyEntityMappingsResponse,
  PagerDutyServiceDependencyResponse,
} from '@pagerduty/backstage-plugin-common';

import { mocked } from 'jest-mock';
import fetch, { Response } from 'node-fetch';
import {
  PagerDutyBackendStore,
  RawDbEntityResultRow,
} from '../db/PagerDutyBackendDatabase';
import { PagerDutyBackendDatabase } from '../db';
import { mockServices, TestDatabases } from '@backstage/backend-test-utils';
import { InMemoryCatalogClient } from '@backstage/catalog-client/testUtils';
import * as Pagerduty from '../services/pagerduty';

jest.mock('node-fetch');

jest.mock('../auth/auth', () => ({
  getAuthToken: jest.fn().mockReturnValue(Promise.resolve('test-token')),
  loadAuthConfig: jest.fn().mockReturnValue(Promise.resolve()),
}));

jest.mock('../services/pagerduty', () => ({
  getServicesIdsByPartialName: jest.fn(),
}));

const testInputs = ['apiToken', 'oauth'];

function mockedResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    status,
  } as Response);
}

const testDatabase = TestDatabases.create();

async function createDatabase(): Promise<PagerDutyBackendStore> {
  return await PagerDutyBackendDatabase.create(
    await testDatabase.init('SQLITE_3'),
  );
}

describe('createRouter', () => {
  let app: express.Express;
  let store: PagerDutyBackendStore;

  // Define test entities for the catalog
  const testEntities = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-component',
        namespace: 'default',
        uid: 'test-uid-1',
        annotations: {
          'pagerduty.com/service-id': 'S3RV1CE1D',
        },
      },
      spec: {
        type: 'service',
        owner: 'team-a',
        lifecycle: 'production',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'component-1',
        namespace: 'default',
        uid: 'uid-1',
        annotations: {
          'pagerduty.com/service-id': 'SERVICE1',
        },
      },
      spec: {
        type: 'service',
        owner: 'team-x',
        lifecycle: 'experimental',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'component-2',
        namespace: 'production',
        uid: 'uid-2',
        annotations: {
          'pagerduty.com/service-id': 'SERVICE2',
        },
      },
      spec: {
        type: 'website',
        owner: 'team-y',
        lifecycle: 'production',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-component-filtered',
        namespace: 'default',
        uid: 'uid-filtered',
        annotations: {
          'pagerduty.com/service-id': 'SERVICEFILTERED',
        },
      },
      spec: {
        type: 'service',
        owner: 'search-team',
        lifecycle: 'production',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-default-search',
        namespace: 'default',
        uid: 'uid-default',
        annotations: {
          'pagerduty.com/service-id': 'SERVICEDEFAULT',
        },
      },
      spec: {
        type: 'service',
        owner: 'default-team',
        lifecycle: 'production',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'component-not-mapped',
        namespace: 'default',
        uid: 'uid-not-mapped',
      },
      spec: {
        type: 'service',
        owner: 'default-team',
        lifecycle: 'production',
      },
    },
  ];

  const catalogApi = new InMemoryCatalogClient({ entities: testEntities });

  beforeAll(async () => {
    const configReader = mockServices.rootConfig({
      data: {
        app: {
          baseUrl: 'https://example.com/extra-path',
        },
        backend: {
          baseUrl: 'https://example.com/extra-path',
        },
        pagerDuty: {
          apiToken: 'test-token',
          oauth: {
            clientId: 'test-client-id',
            clientSecret: 'test-client',
            subDomain: 'test-subdomain',
            region: 'EU',
          },
        },
      },
    });

    store = await createDatabase();
    const router = await createRouter({
      logger: mockServices.rootLogger.mock(),
      config: configReader,
      store,
      discovery: mockServices.discovery(),
      catalogApi: catalogApi,
    });
    app = express().use(router);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('DELETE /dependencies/service/:serviceId', () => {
    it.each(testInputs)(
      'returns 400 if dependencies are not provided',
      async () => {
        const response = await request(app).delete(
          '/dependencies/service/12345',
        );

        expect(response.status).toEqual(400);
        expect(response.body).toEqual(
          "Bad Request: 'dependencies' must be provided as part of the request body",
        );
      },
    );

    it.each(testInputs)(
      'returns 200 if service relations are removed successfully',
      async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, {}));

        const response = await request(app)
          .delete('/dependencies/service/12345')
          .send(['dependency1', 'dependency2']);

        expect(response.status).toEqual(200);
      },
    );
  });

  describe('POST /dependencies/service/:serviceId', () => {
    it.each(testInputs)(
      'returns 400 if dependencies are not provided',
      async () => {
        const response = await request(app).post('/dependencies/service/12345');

        expect(response.status).toEqual(400);
        expect(response.body).toEqual(
          "Bad Request: 'dependencies' must be provided as part of the request body",
        );
      },
    );

    it.each(testInputs)(
      'returns 200 if service relations are added successfully',
      async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, {}));

        const response = await request(app)
          .post('/dependencies/service/12345')
          .send(['dependency1', 'dependency2']);

        expect(response.status).toEqual(200);
      },
    );
  });

  describe('GET /dependencies/service/:serviceId', () => {
    it.each(testInputs)(
      'returns 200 with service relationships if serviceId is valid',
      async () => {
        const mockedResult: PagerDutyServiceDependencyResponse = {
          relationships: [
            {
              id: '12345',
              type: 'service_dependency',
              dependent_service: {
                id: '54321',
                type: 'technical_service_reference',
              },
              supporting_service: {
                id: '12345',
                type: 'technical_service_reference',
              },
            },
            {
              id: '871278',
              type: 'service_dependency',
              dependent_service: {
                id: '91292',
                type: 'technical_service_reference',
              },
              supporting_service: {
                id: '12345',
                type: 'technical_service_reference',
              },
            },
          ],
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, mockedResult));

        const response = await request(app).get('/dependencies/service/12345');

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('relationships');
      },
    );

    it.each(testInputs)('returns 404 if serviceId is not found', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(404, {}));

      const response = await request(app).get(
        '/dependencies/service/S3RVICE1D',
      );

      expect(response.status).toEqual(404);
    });
  });

  describe('GET /escalation_policies', () => {
    it.each(testInputs)('returns ok', async () => {
      mocked(fetch).mockReturnValue(
        mockedResponse(200, {
          escalation_policies: [
            {
              id: '12345',
              name: 'Test Escalation Policy',
              type: 'escalation_policy',
              summary: 'Test Escalation Policy',
              self: 'https://api.pagerduty.com/escalation_policies/12345',
              html_url:
                'https://example.pagerduty.com/escalation_policies/12345',
            },
          ],
        }),
      );

      const expectedStatusCode = 200;
      const expectedResponse = [
        {
          label: 'Test Escalation Policy',
          value: '12345',
        },
      ];

      const response = await request(app).get('/escalation_policies');

      const policies: PagerDutyEscalationPolicy[] = JSON.parse(response.text);

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.body).toEqual(expectedResponse);
      expect(policies.length).toEqual(1);
    });

    it.each(testInputs)('returns unauthorized', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(401, {}));

      const expectedStatusCode = 401;
      const expectedErrorMessage =
        'Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.';

      const response = await request(app).get('/escalation_policies');

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.text).toMatch(expectedErrorMessage);
    });

    it.each(testInputs)(
      'returns empty list when no escalation policies exist',
      async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, { escalation_policies: [] }),
        );

        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyEscalationPolicy[] = [];

        const response = await request(app).get('/escalation_policies');

        const policies: PagerDutyEscalationPolicy[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.body).toEqual(expectedResponse);
        expect(policies.length).toEqual(0);
      },
    );
  });

  describe('GET /oncall-users', () => {
    it.each(testInputs)('returns ok', async () => {
      const escalationPolicyId = '12345';
      const expectedStatusCode = 200;
      const expectedResponse: PagerDutyOnCallUsersResponse = {
        users: [
          {
            id: 'userId2',
            name: 'Jane Doe',
            email: 'jane.doe@email.com',
            avatar_url: 'https://example.pagerduty.com/avatars/123',
            html_url: 'https://example.pagerduty.com/users/123',
            summary: 'Jane Doe',
          },
          {
            id: 'userId1',
            name: 'John Doe',
            email: 'john.doe@email.com',
            avatar_url: 'https://example.pagerduty.com/avatars/123',
            html_url: 'https://example.pagerduty.com/users/123',
            summary: 'John Doe',
          },
        ],
      };

      mocked(fetch).mockReturnValue(
        mockedResponse(200, {
          oncalls: [
            {
              user: {
                id: expectedResponse.users[0].id,
                summary: expectedResponse.users[0].summary,
                name: expectedResponse.users[0].name,
                email: expectedResponse.users[0].email,
                avatar_url: expectedResponse.users[0].avatar_url,
                html_url: expectedResponse.users[0].html_url,
              },
              escalation_level: 1,
            },
            {
              user: {
                id: expectedResponse.users[1].id,
                summary: expectedResponse.users[1].summary,
                name: expectedResponse.users[1].name,
                email: expectedResponse.users[1].email,
                avatar_url: expectedResponse.users[1].avatar_url,
                html_url: expectedResponse.users[1].html_url,
              },
              escalation_level: 1,
            },
          ],
        }),
      );

      const response = await request(app).get(
        `/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`,
      );

      const oncallUsersResponse: PagerDutyOnCallUsersResponse = JSON.parse(
        response.text,
      );

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.body).toEqual(expectedResponse);
      expect(oncallUsersResponse.users.length).toEqual(2);
    });

    it.each(testInputs)('returns unauthorized', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(401, {}));

      const escalationPolicyId = '12345';
      const expectedStatusCode = 401;
      const expectedErrorMessage =
        'Failed to list oncalls. Caller did not supply credentials or did not provide the correct credentials.';

      const response = await request(app).get(
        `/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`,
      );

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.text).toMatch(expectedErrorMessage);
    });

    it.each(testInputs)(
      'returns empty list when no escalation policies exist',
      async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, { oncalls: [] }));

        const escalationPolicyId = '12345';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyOnCallUsersResponse = {
          users: [],
        };

        const response = await request(app).get(
          `/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`,
        );

        const oncallUsersResponse: PagerDutyOnCallUsersResponse = JSON.parse(
          response.text,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.body).toEqual(expectedResponse);
        expect(oncallUsersResponse.users.length).toEqual(0);
      },
    );
  });

  describe('GET /services', () => {
    describe('with integration key', () => {
      it.each(testInputs)('returns ok', async () => {
        const integrationKey = 'INT3GR4T10NK3Y';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceResponse = {
          service: {
            id: 'S3RV1CE1D',
            name: 'Test Service',
            description: 'Test Service Description',
            html_url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy',
              html_url:
                'https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            status: 'active',
          },
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            services: [
              {
                id: expectedResponse.service.id,
                name: expectedResponse.service.name,
                description: expectedResponse.service.description,
                status: expectedResponse.service.status,
                escalation_policy: {
                  id: expectedResponse.service.escalation_policy.id,
                  name: expectedResponse.service.escalation_policy.name,
                  type: expectedResponse.service.escalation_policy.type,
                  html_url: expectedResponse.service.escalation_policy.html_url,
                },
                html_url: expectedResponse.service.html_url,
              },
            ],
            limit: 25,
            offset: 0,
            total: null,
            more: false,
          }),
        );

        const response = await request(app).get(
          `/services?integration_key=${integrationKey}`,
        );

        const service: PagerDutyService = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(service).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const integrationKey = 'INT3GR4T10NK3Y';
        const expectedStatusCode = 401;
        const expectedErrorMessage =
          'Failed to get service. Caller did not supply credentials or did not provide the correct credentials.';

        const response = await request(app).get(
          `/services?integration_key=${integrationKey}`,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)(
        'returns NOT FOUND when integration key does not belong to a service',
        async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [],
              limit: 25,
              offset: 0,
              total: null,
              more: false,
            }),
          );

          const integrationKey = 'INT3GR4T10NK3Y';
          const expectedStatusCode = 404;
          const expectedResponse = {
            errors: [
              'Failed to get service. The requested resource was not found.',
            ],
          };

          const response = await request(app).get(
            `/services?integration_key=${integrationKey}`,
          );

          expect(response.status).toEqual(expectedStatusCode);
          expect(response.body).toEqual(expectedResponse);
        },
      );
    });

    describe('with service id', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceResponse = {
          service: {
            id: 'S3RV1CE1D',
            name: 'Test Service',
            description: 'Test Service Description',
            html_url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy',
              html_url:
                'https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            status: 'active',
          },
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            service: {
              id: expectedResponse.service.id,
              name: expectedResponse.service.name,
              description: expectedResponse.service.description,
              status: expectedResponse.service.status,
              escalation_policy: {
                id: expectedResponse.service.escalation_policy.id,
                name: expectedResponse.service.escalation_policy.name,
                type: expectedResponse.service.escalation_policy.type,
                html_url: expectedResponse.service.escalation_policy.html_url,
              },
              html_url: expectedResponse.service.html_url,
            },
          }),
        );

        const response = await request(app).get(`/services/${serviceId}`);

        const service: PagerDutyService = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(service).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        const serviceId = 'SERV1C31D';
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const expectedStatusCode = 401;
        const expectedErrorMessage =
          'Failed to get service. Caller did not supply credentials or did not provide the correct credentials.';

        const response = await request(app).get(`/services/${serviceId}`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)(
        'returns NOT FOUND if service id does not exist',
        async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(404, {
              error: {
                message: 'Not Found',
                code: 2100,
              },
            }),
          );

          const serviceId = 'SERV1C31D';
          const expectedStatusCode = 404;
          const expectedResponse = {
            errors: [
              'Failed to get service. The requested resource was not found.',
            ],
          };

          const response = await request(app).get(`/services/${serviceId}`);

          expect(response.status).toEqual(expectedStatusCode);
          expect(response.body).toEqual(expectedResponse);
        },
      );
    });

    describe('change-events', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyChangeEventsResponse = {
          change_events: [
            {
              id: 'CH4NG3_3V3NT_1D',
              source: 'GitHub',
              summary: 'Test Change Event 1',
              timestamp: '2020-01-01T00:00:00Z',
              links: [
                {
                  href: 'https://example.pagerduty.com/change_events/CH4NG3_3V3NT_1D',
                  text: 'View in PagerDuty',
                },
              ],
              integration: [
                {
                  id: 'INT3GR4T10N_1D',
                  summary: 'Test Integration 1',
                  type: 'github',
                  html_url:
                    'https://example.pagerduty.com/integrations/INT3GR4T10N_1D',
                },
              ],
            },
          ],
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            change_events: [
              {
                id: expectedResponse.change_events[0].id,
                source: expectedResponse.change_events[0].source,
                summary: expectedResponse.change_events[0].summary,
                timestamp: expectedResponse.change_events[0].timestamp,
                links: [
                  {
                    href: expectedResponse.change_events[0].links[0].href,
                    text: expectedResponse.change_events[0].links[0].text,
                  },
                ],
                integration: [
                  {
                    id: expectedResponse.change_events[0].integration[0].id,
                    summary:
                      expectedResponse.change_events[0].integration[0].summary,
                    type: expectedResponse.change_events[0].integration[0].type,
                    html_url:
                      expectedResponse.change_events[0].integration[0].html_url,
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app).get(
          `/services/${serviceId}/change-events`,
        );

        const changeEvents: PagerDutyChangeEvent[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(changeEvents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 401;
        const expectedErrorMessage =
          'Failed to get change events for service. Caller did not supply credentials or did not provide the correct credentials.';

        const response = await request(app).get(
          `/services/${serviceId}/change-events`,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)(
        'returns NOT FOUND if service id does not exist',
        async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(404, {
              error: { message: 'Not Found', code: 2100 },
            }),
          );

          const serviceId = 'SERV1C31D';
          const expectedStatusCode = 404;
          const expectedResponse = {
            errors: [
              'Failed to get change events for service. The requested resource was not found.',
            ],
          };

          const response = await request(app).get(
            `/services/${serviceId}/change-events`,
          );

          expect(response.status).toEqual(expectedStatusCode);
          expect(response.body).toEqual(expectedResponse);
        },
      );
    });

    describe('incidents', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyIncidentsResponse = {
          incidents: [
            {
              id: '1NC1D3NT_1D',
              status: 'triggered',
              urgency: 'high',
              title: 'Test Incident 1',
              created_at: '2020-01-01T00:00:00Z',
              html_url: 'https://example.pagerduty.com/incidents/1NC1D3NT_1D',
              service: {
                id: 'S3RV1CE1D',
                name: 'Test Service',
                html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                escalation_policy: {
                  id: 'P0L1CY1D',
                  name: 'Test Escalation Policy',
                  html_url:
                    'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                  type: 'escalation_policy_reference',
                },
              },
              assignments: [
                {
                  assignee: {
                    id: '4SS1GN33_1D',
                    summary: 'Test User',
                    name: 'Test User',
                    email: 'test.user@email.com',
                    avatar_url: 'https://example.pagerduty.com/avatars/123',
                    html_url: 'https://example.pagerduty.com/users/123',
                  },
                },
              ],
            },
          ],
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            incidents: [
              {
                id: expectedResponse.incidents[0].id,
                status: expectedResponse.incidents[0].status,
                title: expectedResponse.incidents[0].title,
                urgency: expectedResponse.incidents[0].urgency,
                created_at: expectedResponse.incidents[0].created_at,
                html_url: expectedResponse.incidents[0].html_url,
                service: {
                  id: expectedResponse.incidents[0].service.id,
                  name: expectedResponse.incidents[0].service.name,
                  html_url: expectedResponse.incidents[0].service.html_url,
                  escalation_policy: {
                    id: expectedResponse.incidents[0].service.escalation_policy
                      .id,
                    name: expectedResponse.incidents[0].service
                      .escalation_policy.name,
                    html_url:
                      expectedResponse.incidents[0].service.escalation_policy
                        .html_url,
                    type: expectedResponse.incidents[0].service
                      .escalation_policy.type,
                  },
                },
                assignments: [
                  {
                    assignee: {
                      id: expectedResponse.incidents[0].assignments[0].assignee
                        .id,
                      summary:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .summary,
                      name: expectedResponse.incidents[0].assignments[0]
                        .assignee.name,
                      email:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .email,
                      avatar_url:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .avatar_url,
                      html_url:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .html_url,
                    },
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app).get(
          `/services/${serviceId}/incidents`,
        );

        const incidents: PagerDutyIncident[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(incidents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns ok with optional urgency', async () => {
        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyIncidentsResponse = {
          incidents: [
            {
              id: '1NC1D3NT_1D',
              status: 'triggered',
              title: 'Test Incident 1',
              created_at: '2020-01-01T00:00:00Z',
              html_url: 'https://example.pagerduty.com/incidents/1NC1D3NT_1D',
              service: {
                id: 'S3RV1CE1D',
                name: 'Test Service',
                html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                escalation_policy: {
                  id: 'P0L1CY1D',
                  name: 'Test Escalation Policy',
                  html_url:
                    'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                  type: 'escalation_policy_reference',
                },
              },
              assignments: [
                {
                  assignee: {
                    id: '4SS1GN33_1D',
                    summary: 'Test User',
                    name: 'Test User',
                    email: 'test.user@email.com',
                    avatar_url: 'https://example.pagerduty.com/avatars/123',
                    html_url: 'https://example.pagerduty.com/users/123',
                  },
                },
              ],
            },
          ],
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            incidents: [
              {
                id: expectedResponse.incidents[0].id,
                status: expectedResponse.incidents[0].status,
                title: expectedResponse.incidents[0].title,
                created_at: expectedResponse.incidents[0].created_at,
                html_url: expectedResponse.incidents[0].html_url,
                service: {
                  id: expectedResponse.incidents[0].service.id,
                  name: expectedResponse.incidents[0].service.name,
                  html_url: expectedResponse.incidents[0].service.html_url,
                  escalation_policy: {
                    id: expectedResponse.incidents[0].service.escalation_policy
                      .id,
                    name: expectedResponse.incidents[0].service
                      .escalation_policy.name,
                    html_url:
                      expectedResponse.incidents[0].service.escalation_policy
                        .html_url,
                    type: expectedResponse.incidents[0].service
                      .escalation_policy.type,
                  },
                },
                assignments: [
                  {
                    assignee: {
                      id: expectedResponse.incidents[0].assignments[0].assignee
                        .id,
                      summary:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .summary,
                      name: expectedResponse.incidents[0].assignments[0]
                        .assignee.name,
                      email:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .email,
                      avatar_url:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .avatar_url,
                      html_url:
                        expectedResponse.incidents[0].assignments[0].assignee
                          .html_url,
                    },
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app).get(
          `/services/${serviceId}/incidents`,
        );

        const incidents: PagerDutyIncident[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(incidents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 401;
        const expectedErrorMessage =
          'Failed to get incidents for service. Caller did not supply credentials or did not provide the correct credentials.';

        const response = await request(app).get(
          `/services/${serviceId}/incidents`,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)(
        'returns BAD REQUEST when service id is not provided',
        async () => {
          const serviceId = '';

          const expectedStatusCode = 404;

          const response = await request(app).get(
            `/services/${serviceId}/incidents`,
          );

          expect(response.status).toEqual(expectedStatusCode);
        },
      );
    });

    describe('standards', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = 'SERV1C31D';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceStandardsResponse = {
          standards: {
            resource_id: serviceId,
            resource_type: 'technical_service',
            score: {
              passing: 1,
              total: 2,
            },
            standards: [
              {
                active: true,
                id: 'ST4ND4RD_1D',
                name: 'Test Standard 1',
                description: 'Test Standard Description 1',
                pass: true,
                type: 'technical_service_standard',
              },
              {
                active: true,
                id: 'ST4ND4RD_2D',
                name: 'Test Standard 2',
                description: 'Test Standard Description 2',
                pass: true,
                type: 'technical_service_standard',
              },
            ],
          },
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            resource_id: expectedResponse.standards.resource_id,
            resource_type: expectedResponse.standards.resource_type,
            score: {
              passing: expectedResponse.standards.score.passing,
              total: expectedResponse.standards.score.total,
            },
            standards: [
              {
                active: expectedResponse.standards.standards[0].active,
                id: expectedResponse.standards.standards[0].id,
                name: expectedResponse.standards.standards[0].name,
                description:
                  expectedResponse.standards.standards[0].description,
                pass: expectedResponse.standards.standards[0].pass,
                type: expectedResponse.standards.standards[0].type,
              },
              {
                active: expectedResponse.standards.standards[1].active,
                id: expectedResponse.standards.standards[1].id,
                name: expectedResponse.standards.standards[1].name,
                description:
                  expectedResponse.standards.standards[1].description,
                pass: expectedResponse.standards.standards[1].pass,
                type: expectedResponse.standards.standards[1].type,
              },
            ],
          }),
        );

        const response = await request(app).get(
          `/services/${serviceId}/standards`,
        );

        const result: PagerDutyServiceStandardsResponse = JSON.parse(
          response.text,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(result).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        const serviceId = 'SERV1C31D';
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const expectedStatusCode = 401;
        const expectedErrorMessage =
          'Failed to get service standards for service. Caller did not supply credentials or did not provide the correct credentials.';

        const response = await request(app).get(
          `/services/${serviceId}/standards`,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)(
        'returns BAD REQUEST when service id is not provided',
        async () => {
          const serviceId = '';

          const expectedStatusCode = 404;

          const response = await request(app).get(
            `/services/${serviceId}/standards`,
          );

          expect(response.status).toEqual(expectedStatusCode);
        },
      );
    });

    describe('metrics', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = 'SERV1C31D';
        const serviceName = 'Test Service';
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceMetricsResponse = {
          metrics: [
            {
              service_id: serviceId,
              service_name: serviceName,
              total_high_urgency_incidents: 5,
              total_incident_count: 10,
              total_interruptions: 1,
            },
          ],
        };

        mocked(fetch).mockReturnValue(
          mockedResponse(expectedStatusCode, {
            data: [
              {
                service_id: expectedResponse.metrics[0].service_id,
                service_name: expectedResponse.metrics[0].service_name,
                total_high_urgency_incidents:
                  expectedResponse.metrics[0].total_high_urgency_incidents,
                total_incident_count:
                  expectedResponse.metrics[0].total_incident_count,
                total_interruptions:
                  expectedResponse.metrics[0].total_interruptions,
              },
            ],
          }),
        );

        const response = await request(app).get(
          `/services/${serviceId}/metrics`,
        );

        const result: PagerDutyServiceMetricsResponse = JSON.parse(
          response.text,
        );

        expect(response.status).toEqual(expectedStatusCode);
        expect(result).toEqual(expectedResponse);
      });

      it.each(testInputs)(
        'returns BAD REQUEST when service id is not provided',
        async () => {
          const serviceId = '';

          const expectedStatusCode = 404;

          const response = await request(app).get(
            `/services/${serviceId}/metrics`,
          );

          expect(response.status).toEqual(expectedStatusCode);
        },
      );
    });

    describe('entity mappings', () => {
      it('returns a 400 if no serviceId is provided', async () => {
        const response = await request(app)
          .post('/mapping/entity')
          .send(JSON.stringify({}));
        expect(response.status).toEqual(400);
        expect(response.body).toEqual(
          "Bad Request: 'serviceId' must be provided as part of the request body",
        );
      });

      it('builds entity mapping response for with InSync status when ONLY config mapping exists', async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [];

        const mockEntitiesResponse = {
          items: [
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-1',
                  'pagerduty.com/service-id': 'S3RV1CE1D',
                },
                name: 'ENTITY1',
                uid: '00000000-0000-4000-0000-000000000001',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER1',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER1',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER1',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-2',
                  'pagerduty.com/service-id': 'S3RV1CE2D',
                },
                name: 'ENTITY2',
                uid: '00000000-0000-4000-0000-000000000002',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER2',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER2',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER2',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
          ],
        };

        const mockReferenceDictionary: Record<
          string,
          { ref: string; name: string }
        > = {
          S3RV1CE1D: { ref: 'component:default/entity1', name: 'ENTITY1' },
          S3RV1CE2D: { ref: 'component:default/entity2', name: 'ENTITY2' },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: 'S3RV1CE1D',
            name: 'Test Service 1',
            description: 'Test Service Description 1',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy 1',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M1D',
                type: 'team_reference',
                summary: 'Test Team 1',
                name: 'Test Team 1',
                self: 'https://example.pagerduty.com/teams/T34M1D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE1D',
                  type: 'service_reference',
                  summary: 'S3RV1CE1D',
                  name: 'S3RV1CE1D',
                  self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 1',
                    name: 'Test Escalation Policy 1',
                    self: 'https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY1D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_1',
              },
            ],
            status: 'active',
          },
          {
            id: 'S3RV1CE2D',
            name: 'Test Service 2',
            description: 'Test Service Description 2',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE2D',
            escalation_policy: {
              id: 'P0L1CY2D',
              name: 'Test Escalation Policy 2',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M2D',
                type: 'team_reference',
                summary: 'Test Team 2',
                name: 'Test Team 2',
                self: 'https://example.pagerduty.com/teams/T34M2D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE2D',
                  type: 'service_reference',
                  summary: 'S3RV1CE2D',
                  name: 'S3RV1CE2D',
                  self: 'https://example.pagerduty.com/services/S3RV1CE2D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE2D',
                  escalation_policy: {
                    id: 'P0L1CY2D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 2',
                    name: 'Test Escalation Policy 2',
                    self: 'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY2D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_2',
              },
            ],
            status: 'active',
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: 'ENTITY1',
              entityRef: 'component:default/entity1',
              escalationPolicy: 'Test Escalation Policy 1',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_1',
              serviceId: 'S3RV1CE1D',
              serviceName: 'Test Service 1',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
              status: 'InSync',
              team: 'Test Team 1',
            },
            {
              entityName: 'ENTITY2',
              entityRef: 'component:default/entity2',
              escalationPolicy: 'Test Escalation Policy 2',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_2',
              serviceId: 'S3RV1CE2D',
              serviceName: 'Test Service 2',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE2D',
              status: 'InSync',
              team: 'Test Team 2',
            },
          ],
        };

        const result = await buildEntityMappingsResponse(
          mockEntityMappings,
          mockReferenceDictionary,
          mockEntitiesResponse,
          mockPagerDutyServices,
        );

        expect(result).toEqual(expectedResponse);
      });

      it("builds entity mapping response for with OutOfSync status when config mapping doesn't match database override", async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: 'component:default/entity1',
            serviceId: 'S3RV1CE1D',
            integrationKey: 'BACKSTAGE_INTEGRATION_KEY_OVERRIDE_1',
            id: '1',
          },
        ];

        const mockEntitiesResponse = {
          items: [
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-1',
                  'pagerduty.com/service-id': 'S3RV1CE1D',
                },
                name: 'ENTITY1',
                uid: '00000000-0000-4000-0000-000000000001',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER1',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER1',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER1',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-2',
                  'pagerduty.com/service-id': 'S3RV1CE2D',
                },
                name: 'ENTITY2',
                uid: '00000000-0000-4000-0000-000000000002',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER2',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER2',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER2',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
          ],
        };

        const mockReferenceDictionary: Record<
          string,
          { ref: string; name: string }
        > = {
          S3RV1CE1D: { ref: 'component:default/entity1', name: 'ENTITY1' },
          S3RV1CE2D: { ref: 'component:default/entity2', name: 'ENTITY2' },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: 'S3RV1CE1D',
            name: 'Test Service 1',
            description: 'Test Service Description 1',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy 1',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M1D',
                type: 'team_reference',
                summary: 'Test Team 1',
                name: 'Test Team 1',
                self: 'https://example.pagerduty.com/teams/T34M1D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE1D',
                  type: 'service_reference',
                  summary: 'S3RV1CE1D',
                  name: 'S3RV1CE1D',
                  self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 1',
                    name: 'Test Escalation Policy 1',
                    self: 'https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY1D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_1',
              },
            ],
            status: 'active',
          },
          {
            id: 'S3RV1CE2D',
            name: 'Test Service 2',
            description: 'Test Service Description 2',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE2D',
            escalation_policy: {
              id: 'P0L1CY2D',
              name: 'Test Escalation Policy 2',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M2D',
                type: 'team_reference',
                summary: 'Test Team 2',
                name: 'Test Team 2',
                self: 'https://example.pagerduty.com/teams/T34M2D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE2D',
                  type: 'service_reference',
                  summary: 'S3RV1CE2D',
                  name: 'S3RV1CE2D',
                  self: 'https://example.pagerduty.com/services/S3RV1CE2D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE2D',
                  escalation_policy: {
                    id: 'P0L1CY2D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 2',
                    name: 'Test Escalation Policy 2',
                    self: 'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY2D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_2',
              },
            ],
            status: 'active',
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: 'ENTITY1',
              entityRef: 'component:default/entity1',
              escalationPolicy: 'Test Escalation Policy 1',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_OVERRIDE_1',
              serviceId: 'S3RV1CE1D',
              serviceName: 'Test Service 1',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
              status: 'InSync',
              team: 'Test Team 1',
            },
            {
              entityName: 'ENTITY2',
              entityRef: 'component:default/entity2',
              escalationPolicy: 'Test Escalation Policy 2',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_2',
              serviceId: 'S3RV1CE2D',
              serviceName: 'Test Service 2',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE2D',
              status: 'InSync',
              team: 'Test Team 2',
            },
          ],
        };

        const result = await buildEntityMappingsResponse(
          mockEntityMappings,
          mockReferenceDictionary,
          mockEntitiesResponse,
          mockPagerDutyServices,
        );

        expect(result).toEqual(expectedResponse);
      });

      it('builds entity mapping response with NotMapped status when config nor database entry exist', async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: 'component:default/entity3',
            serviceId: 'S3RV1CE3D',
            integrationKey: 'BACKSTAGE_INTEGRATION_KEY_3',
            id: '1',
          },
        ];

        const mockEntitiesResponse = {
          items: [
            {
              metadata: {
                namespace: 'default',
                annotations: {},
                name: 'ENTITY1',
                uid: '00000000-0000-4000-0000-000000000001',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER1',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER1',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER1',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
          ],
        };

        const mockReferenceDictionary: Record<
          string,
          { ref: string; name: string }
        > = {};

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: 'S3RV1CE1D',
            name: 'Test Service 1',
            description: 'Test Service Description 1',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy 1',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M1D',
                type: 'team_reference',
                summary: 'Test Team 1',
                name: 'Test Team 1',
                self: 'https://example.pagerduty.com/teams/T34M1D',
              },
            ],
            integrations: [],
            status: 'active',
          },
          {
            id: 'S3RV1CE2D',
            name: 'Test Service 2',
            description: 'Test Service Description 2',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE2D',
            escalation_policy: {
              id: 'P0L1CY2D',
              name: 'Test Escalation Policy 2',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M2D',
                type: 'team_reference',
                summary: 'Test Team 2',
                name: 'Test Team 2',
                self: 'https://example.pagerduty.com/teams/T34M2D',
              },
            ],
            integrations: [],
            status: 'active',
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: '',
              entityRef: '',
              escalationPolicy: 'Test Escalation Policy 1',
              integrationKey: '',
              serviceId: 'S3RV1CE1D',
              serviceName: 'Test Service 1',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
              status: 'NotMapped',
              team: 'Test Team 1',
            },
            {
              entityName: '',
              entityRef: '',
              escalationPolicy: 'Test Escalation Policy 2',
              integrationKey: '',
              serviceId: 'S3RV1CE2D',
              serviceName: 'Test Service 2',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE2D',
              status: 'NotMapped',
              team: 'Test Team 2',
            },
          ],
        };

        const result = await buildEntityMappingsResponse(
          mockEntityMappings,
          mockReferenceDictionary,
          mockEntitiesResponse,
          mockPagerDutyServices,
        );

        expect(result).toEqual(expectedResponse);
      });

      it('builds entity mapping response with InSync status when config mapping matches database override', async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: 'component:default/entity1',
            serviceId: 'S3RV1CE1D',
            integrationKey: 'BACKSTAGE_INTEGRATION_KEY_1',
            id: '1',
          },
        ];

        const mockEntitiesResponse = {
          items: [
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-1',
                  'pagerduty.com/service-id': 'S3RV1CE1D',
                },
                name: 'ENTITY1',
                uid: '00000000-0000-4000-0000-000000000001',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER1',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER1',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER1',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
            {
              metadata: {
                namespace: 'default',
                annotations: {
                  'pagerduty.com/integration-key':
                    'PAGERDUTY-INTEGRATION-KEY-2',
                  'pagerduty.com/service-id': 'S3RV1CE2D',
                },
                name: 'ENTITY2',
                uid: '00000000-0000-4000-0000-000000000002',
              },
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              spec: {
                type: 'website',
                lifecycle: 'experimental',
                owner: 'OWNER2',
                system: 'SYSTEM1',
              },
              relations: [
                {
                  type: 'ownedBy',
                  targetRef: 'group:default/OWNER2',
                  target: {
                    kind: 'group',
                    namespace: 'default',
                    name: 'OWNER2',
                  },
                },
                {
                  type: 'partOf',
                  targetRef: 'system:default/SYSTEM1',
                  target: {
                    kind: 'system',
                    namespace: 'default',
                    name: 'SYSTEM1',
                  },
                },
              ],
            },
          ],
        };

        const mockReferenceDictionary: Record<
          string,
          { ref: string; name: string }
        > = {
          S3RV1CE1D: { ref: 'component:default/entity1', name: 'ENTITY1' },
          S3RV1CE2D: { ref: 'component:default/entity2', name: 'ENTITY2' },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: 'S3RV1CE1D',
            name: 'Test Service 1',
            description: 'Test Service Description 1',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
            escalation_policy: {
              id: 'P0L1CY1D',
              name: 'Test Escalation Policy 1',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M1D',
                type: 'team_reference',
                summary: 'Test Team 1',
                name: 'Test Team 1',
                self: 'https://example.pagerduty.com/teams/T34M1D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE1D',
                  type: 'service_reference',
                  summary: 'S3RV1CE1D',
                  name: 'S3RV1CE1D',
                  self: 'https://api.eu.pagerduty.com/services/S3RV1CE1D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 1',
                    name: 'Test Escalation Policy 1',
                    self: 'https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY1D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_1',
              },
            ],
            status: 'active',
          },
          {
            id: 'S3RV1CE2D',
            name: 'Test Service 2',
            description: 'Test Service Description 2',
            html_url: 'https://example.pagerduty.com/services/S3RV1CE2D',
            escalation_policy: {
              id: 'P0L1CY2D',
              name: 'Test Escalation Policy 2',
              html_url:
                'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
              type: 'escalation_policy_reference',
            },
            teams: [
              {
                id: 'T34M2D',
                type: 'team_reference',
                summary: 'Test Team 2',
                name: 'Test Team 2',
                self: 'https://example.pagerduty.com/teams/T34M2D',
              },
            ],
            integrations: [
              {
                id: 'P5M1NGD',
                type: 'app_event_transform_inbound_integration',
                summary: 'Backstage',
                self: 'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                html_url:
                  'https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD',
                name: 'Backstage',
                service: {
                  id: 'S3RV1CE2D',
                  type: 'service_reference',
                  summary: 'S3RV1CE2D',
                  name: 'S3RV1CE2D',
                  self: 'https://example.pagerduty.com/services/S3RV1CE2D',
                  html_url:
                    'https://example.pagerduty.com/service-directory/S3RV1CE2D',
                  escalation_policy: {
                    id: 'P0L1CY2D',
                    type: 'escalation_policy_reference',
                    summary: 'Test Escalation Policy 2',
                    name: 'Test Escalation Policy 2',
                    self: 'https://example.pagerduty.com/escalation_policies/P0L1CY2D',
                    html_url:
                      'https://example.pagerduty.com/escalation-policies/P0L1CY2D',
                  },
                },
                created_at: '2023-11-23T16:43:26Z',
                vendor: {
                  id: 'PRO19CT',
                  type: 'vendor_reference',
                  summary: 'Backstage',
                  self: 'https://api.eu.pagerduty.com/vendors/PRO19CT',
                },
                integration_key: 'BACKSTAGE_INTEGRATION_KEY_2',
              },
            ],
            status: 'active',
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: 'ENTITY1',
              entityRef: 'component:default/entity1',
              escalationPolicy: 'Test Escalation Policy 1',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_1',
              serviceId: 'S3RV1CE1D',
              serviceName: 'Test Service 1',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
              status: 'InSync',
              team: 'Test Team 1',
            },
            {
              entityName: 'ENTITY2',
              entityRef: 'component:default/entity2',
              escalationPolicy: 'Test Escalation Policy 2',
              integrationKey: 'BACKSTAGE_INTEGRATION_KEY_2',
              serviceId: 'S3RV1CE2D',
              serviceName: 'Test Service 2',
              serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE2D',
              status: 'InSync',
              team: 'Test Team 2',
            },
          ],
        };

        const result = await buildEntityMappingsResponse(
          mockEntityMappings,
          mockReferenceDictionary,
          mockEntitiesResponse,
          mockPagerDutyServices,
        );

        expect(result).toEqual(expectedResponse);
      });
    });

    describe('POST /mapping/entities - paginated entity mappings', () => {
      it('returns 400 if offset is negative', async () => {
        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: -1, limit: 10 });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"],
        });
      });

      it('returns 400 if limit is zero', async () => {
        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 0, limit: 0 });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"],
        });
      });

      it('returns 400 if limit is negative', async () => {
        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 0, limit: -10 });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"],
        });
      });

      it('returns 400 if offset is not a number', async () => {
        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 'invalid', limit: 10 });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"],
        });
      });

      it('returns 400 if limit is not a number', async () => {
        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 0, limit: 'invalid' });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"],
        });
      });

      it('returns paginated entities with default parameters', async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            services: [
              {
                id: 'S3RV1CE1D',
                name: 'Test Service 1',
                description: 'Test Service Description 1',
                html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                escalation_policy: {
                  id: 'P0L1CY1D',
                  name: 'Test Escalation Policy 1',
                  html_url:
                    'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                  type: 'escalation_policy_reference',
                },
                teams: [
                  {
                    id: 'T34M1D',
                    name: 'Test Team 1',
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 0, limit: 10 });

        const entity = response.body.entities[0];

        expect(entity).toEqual({
          account: '',
          annotations: {
            'pagerduty.com/integration-key': '',
            'pagerduty.com/service-id': 'S3RV1CE1D',
          },
          escalationPolicy: 'Test Escalation Policy 1',
          id: 'test-uid-1',
          lifecycle: '"production"',
          name: 'test-component',
          namespace: 'default',
          owner: '"team-a"',
          serviceName: 'Test Service 1',
          serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
          status: 'InSync',
          system: '',
          team: 'Test Team 1',
          type: 'Component',
        });
      });

      it('returns paginated entities with custom offset and limit', async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            services: [
              {
                id: 'S3RV1CE1D',
                name: 'Test Service 1',
                description: 'Test Service Description 1',
                html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                escalation_policy: {
                  id: 'P0L1CY1D',
                  name: 'Test Escalation Policy 1',
                  html_url:
                    'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                  type: 'escalation_policy_reference',
                },
                teams: [
                  {
                    id: 'T34M1D',
                    name: 'Test Team 1',
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 20, limit: 5 });

        expect(response.body.entities[0]).toEqual({
          account: '',
          annotations: {
            'pagerduty.com/integration-key': '',
            'pagerduty.com/service-id': 'S3RV1CE1D',
          },
          escalationPolicy: 'Test Escalation Policy 1',
          id: 'test-uid-1',
          lifecycle: '"production"',
          name: 'test-component',
          namespace: 'default',
          owner: '"team-a"',
          serviceName: 'Test Service 1',
          serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
          status: 'InSync',
          system: '',
          team: 'Test Team 1',
          type: 'Component',
        });
      });

      it('returns entities with correct status when mapped to PagerDuty service', async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            services: [
              {
                id: 'S3RV1CE1D',
                name: 'Test Service 1',
                description: 'Test Service Description 1',
                html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                escalation_policy: {
                  id: 'P0L1CY1D',
                  name: 'Test Escalation Policy 1',
                  html_url:
                    'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                  type: 'escalation_policy_reference',
                },
                teams: [
                  {
                    id: 'T34M1D',
                    name: 'Test Team 1',
                  },
                ],
              },
            ],
          }),
        );

        const response = await request(app)
          .post('/mapping/entities')
          .send({ offset: 0, limit: 10 });

        expect(response.body.entities[0]).toEqual({
          name: 'test-component',
          id: 'test-uid-1',
          namespace: 'default',
          type: 'Component',
          system: '',
          owner: '"team-a"',
          lifecycle: '"production"',
          annotations: {
            'pagerduty.com/integration-key': '',
            'pagerduty.com/service-id': 'S3RV1CE1D',
          },
          status: 'InSync',
          serviceName: 'Test Service 1',
          serviceUrl: 'https://example.pagerduty.com/services/S3RV1CE1D',
          team: 'Test Team 1',
          escalationPolicy: 'Test Escalation Policy 1',
          account: '',
        });
      });

      describe('serviceName filter', () => {
        beforeEach(async () => {
          await store.insertEntityMapping({
            serviceId: 'S3RV1CE1D',
            entityRef: 'component:default/test-component',
            integrationKey: 'integration-key-1',
            account: '',
          });
        });

        it('returns filtered entities when serviceName filter matches services', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue(['S3RV1CE1D']);

          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'Test Servi' },
            });

          expect(response.status).toEqual(200);
          expect(Pagerduty.getServicesIdsByPartialName).toHaveBeenCalledWith('Test Servi');
          expect(response.body.entities).toHaveLength(1);
          expect(response.body.entities[0].serviceName).toEqual('Test Service 1');
        });

        it('returns empty array when serviceName filter matches no services', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([]);

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'NonExistent Service' },
            });

          expect(response.status).toEqual(200);
          expect(Pagerduty.getServicesIdsByPartialName).toHaveBeenCalledWith(
            'NonExistent Service',
          );
          expect(response.body.entities).toEqual([]);
          expect(response.body.totalCount).toEqual(0);
        });

        it('returns empty array when serviceName filter matches services but no entity mappings exist', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([
            'UNMAPPED_SERVICE_ID',
          ]);

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'Unmapped Service' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toEqual([]);
          expect(response.body.totalCount).toEqual(0);
        });

        it('returns empty array when serviceName filter matches services with mappings but no entity refs', async () => {
          // Create a mapping with no entity ref
          await store.insertEntityMapping({
            serviceId: 'SERVICE_NO_REF',
            entityRef: '',
            integrationKey: 'integration-key-2',
            account: '',
          });

          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([
            'SERVICE_NO_REF',
          ]);

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'No Ref Service' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toEqual([]);
          expect(response.body.totalCount).toEqual(0);
        });

        it('handles serviceName filter with whitespace', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([
            'S3RV1CE1D',
          ]);

          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: '  Test Service  ' },
            });

          expect(response.status).toEqual(200);
          expect(Pagerduty.getServicesIdsByPartialName).toHaveBeenCalledWith(
            'Test Service',
          );
          expect(response.body.entities).toHaveLength(1);
        });

        it('ignores empty serviceName filter', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: '' },
            });

          expect(response.status).toEqual(200);
          expect(Pagerduty.getServicesIdsByPartialName).not.toHaveBeenCalled();
          expect(response.body.entities).toHaveLength(testEntities.length);
        });

        it('ignores whitespace-only serviceName filter', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: '   ' },
            });

          expect(response.status).toEqual(200);
          expect(Pagerduty.getServicesIdsByPartialName).not.toHaveBeenCalled();
          expect(response.body.entities).toHaveLength(testEntities.length);
        });
      });

      describe('status filter', () => {
        beforeEach(async () => {
          // Insert entity mappings for testing
          await store.insertEntityMapping({
            serviceId: 'S3RV1CE1D',
            entityRef: 'component:default/test-component',
            integrationKey: 'integration-key-1',
            account: '',
          });
        });

        it('returns only entities with InSync status when filtered', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { status: 'InSync' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toHaveLength(1);
          expect(response.body.entities[0].status).toEqual('InSync');
        });

        it('returns only entities with NotMapped status when filtered', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
                {
                  id: 'SERVICE1',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
                {
                  id: 'SERVICE2',
                  name: 'Test Service 2',
                  description: 'Test Service Description 2',
                  html_url: 'https://example.pagerduty.com/services/SERVICE2',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
                {
                  id: 'SERVICEDEFAULT',
                  name: 'Test Service Default',
                  description: 'Test Service Description Default',
                  html_url: 'https://example.pagerduty.com/services/SERVICEDEFAULT',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
                {
                  id: 'SERVICEFILTERED',
                  name: 'Test Service Filtered',
                  description: 'Test Service Description Filtered',
                  html_url: 'https://example.pagerduty.com/services/SERVICEFILTERED',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { status: 'NotMapped' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toHaveLength(1);
          expect(response.body.entities[0].status).toEqual('NotMapped');
          expect(response.body.entities[0].name).toEqual('component-not-mapped');
        });

        it('returns empty array when no entities match status filter', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url:
                      'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { status: 'OutOfSync' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toEqual([]);
        });

        it('handles status filter with whitespace', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url:
                      'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { status: '  InSync  ' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toHaveLength(1);
        });

        it('applies correct pagination when status filter is used', async () => {
          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url: 'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 1,
              filters: { status: 'InSync' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toHaveLength(1);
          expect(response.body.totalCount).toBeGreaterThanOrEqual(1);
        });
      });

      describe('combined filters', () => {
        beforeEach(async () => {
          await store.insertEntityMapping({
            serviceId: 'S3RV1CE1D',
            entityRef: 'component:default/test-component',
            integrationKey: 'integration-key-1',
            account: '',
          });
        });

        it('applies both serviceName and status filters', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([
            'S3RV1CE1D',
          ]);

          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url:
                      'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'Test Service', status: 'InSync' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toHaveLength(1);
          expect(response.body.entities[0].status).toEqual('InSync');
          expect(response.body.entities[0].serviceName).toEqual('Test Service 1',);
        });

        it('returns empty array when combined filters match no entities', async () => {
          mocked(Pagerduty.getServicesIdsByPartialName).mockResolvedValue([
            'S3RV1CE1D',
          ]);

          mocked(fetch).mockReturnValue(
            mockedResponse(200, {
              services: [
                {
                  id: 'S3RV1CE1D',
                  name: 'Test Service 1',
                  description: 'Test Service Description 1',
                  html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
                  escalation_policy: {
                    id: 'P0L1CY1D',
                    name: 'Test Escalation Policy 1',
                    html_url:
                      'https://example.pagerduty.com/escalation_policies/P0L1CY1D',
                    type: 'escalation_policy_reference',
                  },
                  teams: [
                    {
                      id: 'T34M1D',
                      name: 'Test Team 1',
                    },
                  ],
                },
              ],
            }),
          );

          const response = await request(app)
            .post('/mapping/entities')
            .send({
              offset: 0,
              limit: 10,
              filters: { serviceName: 'Test Service', status: 'OutOfSync' },
            });

          expect(response.status).toEqual(200);
          expect(response.body.entities).toEqual([]);
        });
      });

      // TODO: Test the rest of the filters when InMemoryCatalogApi supports fullTextSearch (https://pagerduty.atlassian.net/browse/DEVECO-623)
    });

    describe('POST /mapping/entities/bulk', () => {
      it('returns 400 if mappings is not an array', async () => {
        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings: 'invalid' });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          error: "Bad Request: 'mappings' must be an array",
        });
      });

      it('returns 400 if mappings array is empty', async () => {
        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings: [] });

        expect(response.status).toEqual(400);
        expect(response.body).toEqual({
          error: "Bad Request: 'mappings' array cannot be empty",
        });
      });

      it('returns error for mappings without serviceId', async () => {
        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({
            mappings: [
              {
                entityRef: 'component:default/test',
                integrationKey: 'TEST_KEY',
              },
            ],
          });

        expect(response.status).toEqual(200);
        expect(response.body.errorCount).toEqual(1);
        expect(response.body.errors[0]).toEqual({
          entityRef: 'component:default/test',
          error: 'Missing serviceId',
        });
      });

      it('successfully creates new bulk mappings', async () => {
        const mappings = [
          {
            serviceId: 'NEW_SERVICE_1',
            entityRef: 'component:default/new-component-1',
            integrationKey: 'INT_KEY_1',
            account: 'test-account',
          },
          {
            serviceId: 'NEW_SERVICE_2',
            entityRef: 'component:default/new-component-2',
            integrationKey: 'INT_KEY_2',
            account: 'test-account',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body.successCount).toEqual(2);
        expect(response.body.skippedCount).toEqual(0);
        expect(response.body.errorCount).toEqual(0);
        expect(response.body.success).toHaveLength(2);
        expect(response.body.success[0]).toMatchObject({
          serviceId: 'NEW_SERVICE_1',
          entityRef: 'component:default/new-component-1',
          integrationKey: 'INT_KEY_1',
        });
      });

      it('skips existing mappings based on serviceId', async () => {
        // First, create a mapping
        await request(app).post('/mapping/entity').send({
          serviceId: 'EXISTING_SERVICE',
          entityRef: 'component:default/existing',
          integrationKey: 'EXISTING_KEY',
          account: 'test-account',
        });

        // Try to bulk create including the existing one
        const mappings = [
          {
            serviceId: 'EXISTING_SERVICE',
            entityRef: 'component:default/existing',
            integrationKey: 'EXISTING_KEY',
            account: 'test-account',
          },
          {
            serviceId: 'NEW_SERVICE_3',
            entityRef: 'component:default/new-component-3',
            integrationKey: 'INT_KEY_3',
            account: 'test-account',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body.successCount).toEqual(1);
        expect(response.body.skippedCount).toEqual(1);
        expect(response.body.errorCount).toEqual(0);
        expect(response.body.skipped).toHaveLength(1);
        expect(response.body.skipped[0]).toEqual({
          entityRef: 'component:default/existing',
          serviceId: 'EXISTING_SERVICE',
          reason: 'Mapping already exists for this service ID',
        });
      });

      it('creates integration key when mapping is defined without one', async () => {
        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              service: {
                id: 'SERVICE_NO_INT',
                name: 'Service Without Integration',
                integrations: [],
              },
            }),
          )
          .mockReturnValueOnce(
            mockedResponse(201, {
              integration: {
                integration_key: 'CREATED_INTEGRATION_KEY',
              },
            }),
          );

        const mappings = [
          {
            serviceId: 'SERVICE_NO_INT',
            entityRef: 'component:default/test-component',
            integrationKey: '',
            account: 'test-account',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body.successCount).toEqual(1);
        expect(response.body.success[0].integrationKey).toEqual(
          'CREATED_INTEGRATION_KEY',
        );
      });

      it('uses existing integration key when available', async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, {
            service: {
              id: 'SERVICE_WITH_INT',
              name: 'Service With Integration',
              integrations: [
                {
                  vendor: {
                    id: 'PRO19CT',
                  },
                  integration_key: 'EXISTING_BACKSTAGE_KEY',
                },
              ],
            },
          }),
        );

        const mappings = [
          {
            serviceId: 'SERVICE_WITH_INT',
            entityRef: 'component:default/test-component',
            integrationKey: '',
            account: 'test-account',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body.successCount).toEqual(1);
        expect(response.body.success[0].integrationKey).toEqual(
          'EXISTING_BACKSTAGE_KEY',
        );
      });

      it('handles mixed success, skip, and error scenarios', async () => {
        // Create an existing mapping
        await request(app).post('/mapping/entity').send({
          serviceId: 'EXISTING_MIXED',
          entityRef: 'component:default/existing',
          integrationKey: 'EXISTING_KEY',
          account: 'test-account',
        });

        mocked(fetch).mockReturnValue(
          mockedResponse(404, {
            error: {
              message: 'Service not found',
            },
          }),
        );

        const mappings = [
          {
            serviceId: 'EXISTING_MIXED',
            entityRef: 'component:default/existing',
            integrationKey: 'KEY',
          },
          {
            serviceId: 'NEW_SERVICE_VALID',
            entityRef: 'component:default/new-valid',
            integrationKey: 'KEY_VALID',
          },
          {
            entityRef: 'component:default/missing-service-id',
            integrationKey: 'KEY',
          },
          {
            serviceId: 'SERVICE_NEEDS_INT',
            entityRef: 'component:default/needs-integration',
            integrationKey: '',
            account: 'test-account',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body.total).toEqual(4);
        expect(response.body.skippedCount).toEqual(1);
        expect(response.body.errorCount).toBeGreaterThanOrEqual(1);
        expect(response.body.successCount).toBeGreaterThanOrEqual(1);
      });

      it('returns proper response structure with all counts', async () => {
        const mappings = [
          {
            serviceId: 'BULK_SERVICE_1',
            entityRef: 'component:default/bulk-1',
            integrationKey: 'BULK_KEY_1',
          },
        ];

        const response = await request(app)
          .post('/mapping/entities/bulk')
          .send({ mappings });

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('skipped');
        expect(response.body).toHaveProperty('errors');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('successCount');
        expect(response.body).toHaveProperty('skippedCount');
        expect(response.body).toHaveProperty('errorCount');
      });
    });
  });
});
