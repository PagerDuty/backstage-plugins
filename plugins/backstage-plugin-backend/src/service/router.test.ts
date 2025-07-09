import { HostDiscovery, getVoidLogger } from '@backstage/backend-common';
import { ConfigReader } from '@backstage/config';
import express from 'express';
import request from 'supertest';

import { createRouter, createComponentEntitiesReferenceDict, buildEntityMappingsResponse } from './router';
import { PagerDutyEscalationPolicy, PagerDutyService, PagerDutyServiceResponse, PagerDutyOnCallUsersResponse, PagerDutyChangeEventsResponse, PagerDutyChangeEvent, PagerDutyIncidentsResponse, PagerDutyIncident, PagerDutyServiceStandardsResponse, PagerDutyServiceMetricsResponse, PagerDutyEntityMappingsResponse, PagerDutyServiceDependencyResponse } from '@pagerduty/backstage-plugin-common';

import { mocked } from "jest-mock";
import fetch, { Response } from "node-fetch";
import { PagerDutyBackendStore, RawDbEntityResultRow } from '../db/PagerDutyBackendDatabase';
import { PagerDutyBackendDatabase } from '../db';
import { TestDatabases } from '@backstage/backend-test-utils';

jest.mock("node-fetch");

jest.mock("../auth/auth", () => ({
  getAuthToken: jest.fn().mockReturnValue(Promise.resolve('test-token')),
  loadAuthConfig: jest.fn().mockReturnValue(Promise.resolve()),
}));

const testInputs = [
  "apiToken",
  "oauth",
];

function mockedResponse(status: number, body: any): Promise<Response> {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    status
  } as Response);
}

const testDatabase = TestDatabases.create();

async function createDatabase(): Promise<PagerDutyBackendStore> {
  return await PagerDutyBackendDatabase.create(
    await testDatabase.init("SQLITE_3"),
  );
}

describe('createRouter', () => {
  let app: express.Express;

  beforeAll(async () => {
    const configReader = new ConfigReader({
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
        }
      },
    });

    const router = await createRouter(
      {
        logger: getVoidLogger(),
        config: configReader,
        store: await createDatabase(),
        discovery: HostDiscovery.fromConfig(configReader),
      }
    );
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
    it.each(testInputs)('returns 400 if dependencies are not provided', async () => {
      const response = await request(app).delete('/dependencies/service/12345');

      expect(response.status).toEqual(400);
      expect(response.body).toEqual("Bad Request: 'dependencies' must be provided as part of the request body");
    });

    it.each(testInputs)('returns 200 if service relations are removed successfully', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(200, {}));

      const response = await request(app)
        .delete('/dependencies/service/12345')
        .send(['dependency1', 'dependency2']);

      expect(response.status).toEqual(200);
    });
  });

  describe('POST /dependencies/service/:serviceId', () => {
    it.each(testInputs)('returns 400 if dependencies are not provided', async () => {
      const response = await request(app).post('/dependencies/service/12345');

      expect(response.status).toEqual(400);
      expect(response.body).toEqual("Bad Request: 'dependencies' must be provided as part of the request body");
    });

    it.each(testInputs)('returns 200 if service relations are added successfully', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(200, {}));

      const response = await request(app)
        .post('/dependencies/service/12345')
        .send(['dependency1', 'dependency2']);

      expect(response.status).toEqual(200);
    });
  });

  describe('GET /dependencies/service/:serviceId', () => {
    it.each(testInputs)('returns 200 with service relationships if serviceId is valid', async () => {
      const mockedResult : PagerDutyServiceDependencyResponse = {
        relationships: [
          {
            id: "12345",
            type: "service_dependency",
            dependent_service: {
              id: "54321",
              type: "technical_service_reference"
            },
            supporting_service: {
              id: "12345",
              type: "technical_service_reference"
            }
          },
          {
            id: "871278",
            type: "service_dependency",
            dependent_service: {
              id: "91292",
              type: "technical_service_reference"
            },
            supporting_service: {
              id: "12345",
              type: "technical_service_reference"
            }
          }
        ]
      }

      mocked(fetch).mockReturnValue(mockedResponse(200, mockedResult));

      const response = await request(app).get('/dependencies/service/12345');

      expect(response.status).toEqual(200);
      expect(response.body).toHaveProperty('relationships');
    });

    it.each(testInputs)('returns 404 if serviceId is not found', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(404, {}));

      const response = await request(app).get('/dependencies/service/S3RVICE1D');

      expect(response.status).toEqual(404);
    });
  });

  describe('GET /escalation_policies', () => {
    it.each(testInputs)('returns ok', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(200, {
        escalation_policies: [
          {
            id: "12345",
            name: "Test Escalation Policy",
            type: "escalation_policy",
            summary: "Test Escalation Policy",
            self: "https://api.pagerduty.com/escalation_policies/12345",
            html_url: "https://example.pagerduty.com/escalation_policies/12345",
          }
        ]
      })
      );

      const expectedStatusCode = 200;
      const expectedResponse = [
        {
          label: "Test Escalation Policy",
          value: "12345",
        }
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
      const expectedErrorMessage = "Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.";

      const response = await request(app).get('/escalation_policies');

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.text).toMatch(expectedErrorMessage);
    });

    it.each(testInputs)('returns empty list when no escalation policies exist', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(200, { escalation_policies: [] }));

      const expectedStatusCode = 200;
      const expectedResponse: PagerDutyEscalationPolicy[] = [];

      const response = await request(app).get('/escalation_policies');

      const policies: PagerDutyEscalationPolicy[] = JSON.parse(response.text);

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.body).toEqual(expectedResponse);
      expect(policies.length).toEqual(0);
    });
  });

  describe('GET /oncall-users', () => {
    it.each(testInputs)('returns ok', async () => {
      const escalationPolicyId = "12345";
      const expectedStatusCode = 200;
      const expectedResponse: PagerDutyOnCallUsersResponse = {
        users:
          [
            {
              id: "userId2",
              name: "Jane Doe",
              email: "jane.doe@email.com",
              avatar_url: "https://example.pagerduty.com/avatars/123",
              html_url: "https://example.pagerduty.com/users/123",
              summary: "Jane Doe",
            },
            {
              id: "userId1",
              name: "John Doe",
              email: "john.doe@email.com",
              avatar_url: "https://example.pagerduty.com/avatars/123",
              html_url: "https://example.pagerduty.com/users/123",
              summary: "John Doe",
            }
          ]
      };

      mocked(fetch).mockReturnValue(mockedResponse(200, {
        "oncalls": [
          {
            "user": {
              "id": expectedResponse.users[0].id,
              "summary": expectedResponse.users[0].summary,
              "name": expectedResponse.users[0].name,
              "email": expectedResponse.users[0].email,
              "avatar_url": expectedResponse.users[0].avatar_url,
              "html_url": expectedResponse.users[0].html_url,
            },
            "escalation_level": 1
          },
          {
            "user": {
              "id": expectedResponse.users[1].id,
              "summary": expectedResponse.users[1].summary,
              "name": expectedResponse.users[1].name,
              "email": expectedResponse.users[1].email,
              "avatar_url": expectedResponse.users[1].avatar_url,
              "html_url": expectedResponse.users[1].html_url,
            },
            "escalation_level": 1
          }
        ]
      })
      );

      const response = await request(app).get(`/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`);

      const oncallUsersResponse: PagerDutyOnCallUsersResponse = JSON.parse(response.text);

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.body).toEqual(expectedResponse);
      expect(oncallUsersResponse.users.length).toEqual(2);
    });

    it.each(testInputs)('returns unauthorized', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(401, {}));

      const escalationPolicyId = "12345";
      const expectedStatusCode = 401;
      const expectedErrorMessage = "Failed to list oncalls. Caller did not supply credentials or did not provide the correct credentials.";

      const response = await request(app).get(`/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`);

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.text).toMatch(expectedErrorMessage);
    });

    it.each(testInputs)('returns empty list when no escalation policies exist', async () => {
      mocked(fetch).mockReturnValue(mockedResponse(200, { "oncalls": [] }));

      const escalationPolicyId = "12345";
      const expectedStatusCode = 200;
      const expectedResponse: PagerDutyOnCallUsersResponse = {
        "users": []
      };

      const response = await request(app).get(`/oncall-users?escalation_policy_ids[]=${escalationPolicyId}`);

      const oncallUsersResponse: PagerDutyOnCallUsersResponse = JSON.parse(response.text);

      expect(response.status).toEqual(expectedStatusCode);
      expect(response.body).toEqual(expectedResponse);
      expect(oncallUsersResponse.users.length).toEqual(0);
    });
  });

  describe('GET /services', () => {
    describe('with integration key', () => {
      it.each(testInputs)('returns ok', async () => {
        const integrationKey = "INT3GR4T10NK3Y";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceResponse = {
          service: {
            id: "S3RV1CE1D",
            name: "Test Service",
            description: "Test Service Description",
            html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy",
              html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            status: "active",
          }
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "services": [
            {
              "id": expectedResponse.service.id,
              "name": expectedResponse.service.name,
              "description": expectedResponse.service.description,
              "status": expectedResponse.service.status,
              "escalation_policy": {
                "id": expectedResponse.service.escalation_policy.id,
                "name": expectedResponse.service.escalation_policy.name,
                "type": expectedResponse.service.escalation_policy.type,
                "html_url": expectedResponse.service.escalation_policy.html_url
              },
              "html_url": expectedResponse.service.html_url
            }
          ],
          "limit": 25,
          "offset": 0,
          "total": null,
          "more": false
        })
        );

        const response = await request(app).get(`/services?integration_key=${integrationKey}`);

        const service: PagerDutyService = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(service).toEqual(expectedResponse);

      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const integrationKey = "INT3GR4T10NK3Y";
        const expectedStatusCode = 401;
        const expectedErrorMessage = "Failed to get service. Caller did not supply credentials or did not provide the correct credentials.";

        const response = await request(app).get(`/services?integration_key=${integrationKey}`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)('returns NOT FOUND when integration key does not belong to a service', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "services": [],
          "limit": 25,
          "offset": 0,
          "total": null,
          "more": false
        }
        )
        );

        const integrationKey = "INT3GR4T10NK3Y";
        const expectedStatusCode = 404;
        const expectedResponse = { "errors": ["Failed to get service. The requested resource was not found."] };

        const response = await request(app).get(`/services?integration_key=${integrationKey}`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.body).toEqual(expectedResponse);

      });
    });

    describe('with service id', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = "SERV1C31D";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceResponse = {
          service: {
            id: "S3RV1CE1D",
            name: "Test Service",
            description: "Test Service Description",
            html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy",
              html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            status: "active",
          }
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "service":
          {
            "id": expectedResponse.service.id,
            "name": expectedResponse.service.name,
            "description": expectedResponse.service.description,
            "status": expectedResponse.service.status,
            "escalation_policy": {
              "id": expectedResponse.service.escalation_policy.id,
              "name": expectedResponse.service.escalation_policy.name,
              "type": expectedResponse.service.escalation_policy.type,
              "html_url": expectedResponse.service.escalation_policy.html_url
            },
            "html_url": expectedResponse.service.html_url
          }
        })
        );

        const response = await request(app).get(`/services/${serviceId}`);

        const service: PagerDutyService = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(service).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        const serviceId = "SERV1C31D";
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const expectedStatusCode = 401;
        const expectedErrorMessage = "Failed to get service. Caller did not supply credentials or did not provide the correct credentials.";

        const response = await request(app).get(`/services/${serviceId}`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)('returns NOT FOUND if service id does not exist', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(404, {
          "error": {
            "message": "Not Found",
            "code": 2100
          }
        }
        )
        );

        const serviceId = "SERV1C31D";
        const expectedStatusCode = 404;
        const expectedResponse = { "errors": ["Failed to get service. The requested resource was not found."] };

        const response = await request(app).get(`/services/${serviceId}`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.body).toEqual(expectedResponse);
      });
    });

    describe('change-events', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = "SERV1C31D";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyChangeEventsResponse = {
          change_events: [
            {
              id: "CH4NG3_3V3NT_1D",
              source: "GitHub",
              summary: "Test Change Event 1",
              timestamp: "2020-01-01T00:00:00Z",
              links: [
                {
                  href: "https://example.pagerduty.com/change_events/CH4NG3_3V3NT_1D",
                  text: "View in PagerDuty",
                },
              ],
              integration: [
                {
                  id: "INT3GR4T10N_1D",
                  summary: "Test Integration 1",
                  type: "github",
                  html_url: "https://example.pagerduty.com/integrations/INT3GR4T10N_1D",
                }
              ]
            }
          ]
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "change_events": [
            {
              "id": expectedResponse.change_events[0].id,
              "source": expectedResponse.change_events[0].source,
              "summary": expectedResponse.change_events[0].summary,
              "timestamp": expectedResponse.change_events[0].timestamp,
              "links": [
                {
                  "href": expectedResponse.change_events[0].links[0].href,
                  "text": expectedResponse.change_events[0].links[0].text,
                }
              ],
              "integration": [
                {
                  "id": expectedResponse.change_events[0].integration[0].id,
                  "summary": expectedResponse.change_events[0].integration[0].summary,
                  "type": expectedResponse.change_events[0].integration[0].type,
                  "html_url": expectedResponse.change_events[0].integration[0].html_url,
                }
              ]
            }
          ]
        })
        );

        const response = await request(app).get(`/services/${serviceId}/change-events`);

        const changeEvents: PagerDutyChangeEvent[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(changeEvents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const serviceId = "SERV1C31D";
        const expectedStatusCode = 401;
        const expectedErrorMessage = "Failed to get change events for service. Caller did not supply credentials or did not provide the correct credentials.";

        const response = await request(app).get(`/services/${serviceId}/change-events`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)('returns NOT FOUND if service id does not exist', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(404, { "error": { "message": "Not Found", "code": 2100 } }));

        const serviceId = "SERV1C31D";
        const expectedStatusCode = 404;
        const expectedResponse = { "errors": ["Failed to get change events for service. The requested resource was not found."] };

        const response = await request(app).get(`/services/${serviceId}/change-events`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.body).toEqual(expectedResponse);
      });
    });

    describe('incidents', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = "SERV1C31D";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyIncidentsResponse = {
          incidents: [
            {
              id: "1NC1D3NT_1D",
              status: "triggered",
              urgency: "high",
              title: "Test Incident 1",
              created_at: "2020-01-01T00:00:00Z",
              html_url: "https://example.pagerduty.com/incidents/1NC1D3NT_1D",
              service: {
                id: "S3RV1CE1D",
                name: "Test Service",
                html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
                escalation_policy: {
                  id: "P0L1CY1D",
                  name: "Test Escalation Policy",
                  html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
                  type: "escalation_policy_reference",
                },
              },
              assignments: [
                {
                  assignee: {
                    id: "4SS1GN33_1D",
                    summary: "Test User",
                    name: "Test User",
                    email: "test.user@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                  }
                }
              ]
            }
          ]
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "incidents": [
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
                  id: expectedResponse.incidents[0].service.escalation_policy.id,
                  name: expectedResponse.incidents[0].service.escalation_policy.name,
                  html_url: expectedResponse.incidents[0].service.escalation_policy.html_url,
                  type: expectedResponse.incidents[0].service.escalation_policy.type,
                },
              },
              assignments: [
                {
                  assignee: {
                    id: expectedResponse.incidents[0].assignments[0].assignee.id,
                    summary: expectedResponse.incidents[0].assignments[0].assignee.summary,
                    name: expectedResponse.incidents[0].assignments[0].assignee.name,
                    email: expectedResponse.incidents[0].assignments[0].assignee.email,
                    avatar_url: expectedResponse.incidents[0].assignments[0].assignee.avatar_url,
                    html_url: expectedResponse.incidents[0].assignments[0].assignee.html_url,
                  }
                }
              ]
            }
          ]
        }));

        const response = await request(app).get(`/services/${serviceId}/incidents`);

        const incidents: PagerDutyIncident[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(incidents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns ok with optional urgency', async () => {
        const serviceId = "SERV1C31D";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyIncidentsResponse = {
          incidents: [
            {
              id: "1NC1D3NT_1D",
              status: "triggered",
              title: "Test Incident 1",
              created_at: "2020-01-01T00:00:00Z",
              html_url: "https://example.pagerduty.com/incidents/1NC1D3NT_1D",
              service: {
                id: "S3RV1CE1D",
                name: "Test Service",
                html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
                escalation_policy: {
                  id: "P0L1CY1D",
                  name: "Test Escalation Policy",
                  html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
                  type: "escalation_policy_reference",
                },
              },
              assignments: [
                {
                  assignee: {
                    id: "4SS1GN33_1D",
                    summary: "Test User",
                    name: "Test User",
                    email: "test.user@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                  }
                }
              ]
            }
          ]
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "incidents": [
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
                  id: expectedResponse.incidents[0].service.escalation_policy.id,
                  name: expectedResponse.incidents[0].service.escalation_policy.name,
                  html_url: expectedResponse.incidents[0].service.escalation_policy.html_url,
                  type: expectedResponse.incidents[0].service.escalation_policy.type,
                },
              },
              assignments: [
                {
                  assignee: {
                    id: expectedResponse.incidents[0].assignments[0].assignee.id,
                    summary: expectedResponse.incidents[0].assignments[0].assignee.summary,
                    name: expectedResponse.incidents[0].assignments[0].assignee.name,
                    email: expectedResponse.incidents[0].assignments[0].assignee.email,
                    avatar_url: expectedResponse.incidents[0].assignments[0].assignee.avatar_url,
                    html_url: expectedResponse.incidents[0].assignments[0].assignee.html_url,
                  }
                }
              ]
            }
          ]
        })
        );

        const response = await request(app).get(`/services/${serviceId}/incidents`);

        const incidents: PagerDutyIncident[] = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(incidents).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const serviceId = "SERV1C31D";
        const expectedStatusCode = 401;
        const expectedErrorMessage = "Failed to get incidents for service. Caller did not supply credentials or did not provide the correct credentials.";

        const response = await request(app).get(`/services/${serviceId}/incidents`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)('returns BAD REQUEST when service id is not provided', async () => {
        const serviceId = '';

        const expectedStatusCode = 404;

        const response = await request(app).get(`/services/${serviceId}/incidents`);

        expect(response.status).toEqual(expectedStatusCode);
      });
    });

    describe('standards', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = "SERV1C31D";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceStandardsResponse = {
          standards: {
            resource_id: serviceId,
            resource_type: "technical_service",
            score: {
              passing: 1,
              total: 2,
            },
            standards: [
              {
                active: true,
                id: "ST4ND4RD_1D",
                name: "Test Standard 1",
                description: "Test Standard Description 1",
                pass: true,
                type: "technical_service_standard",
              },
              {
                active: true,
                id: "ST4ND4RD_2D",
                name: "Test Standard 2",
                description: "Test Standard Description 2",
                pass: true,
                type: "technical_service_standard",
              },
            ]
          }
        };

        mocked(fetch).mockReturnValue(mockedResponse(200, {
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
              description: expectedResponse.standards.standards[0].description,
              pass: expectedResponse.standards.standards[0].pass,
              type: expectedResponse.standards.standards[0].type,
            },
            {
              active: expectedResponse.standards.standards[1].active,
              id: expectedResponse.standards.standards[1].id,
              name: expectedResponse.standards.standards[1].name,
              description: expectedResponse.standards.standards[1].description,
              pass: expectedResponse.standards.standards[1].pass,
              type: expectedResponse.standards.standards[1].type,
            },
          ]
        }));

        const response = await request(app).get(`/services/${serviceId}/standards`);

        const result: PagerDutyServiceStandardsResponse = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(result).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns unauthorized', async () => {
        const serviceId = "SERV1C31D";
        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const expectedStatusCode = 401;
        const expectedErrorMessage = "Failed to get service standards for service. Caller did not supply credentials or did not provide the correct credentials.";

        const response = await request(app).get(`/services/${serviceId}/standards`);

        expect(response.status).toEqual(expectedStatusCode);
        expect(response.text).toMatch(expectedErrorMessage);
      });

      it.each(testInputs)('returns BAD REQUEST when service id is not provided', async () => {
        const serviceId = '';

        const expectedStatusCode = 404;

        const response = await request(app).get(`/services/${serviceId}/standards`);

        expect(response.status).toEqual(expectedStatusCode);
      });
    });

    describe('metrics', () => {
      it.each(testInputs)('returns ok', async () => {
        const serviceId = "SERV1C31D";
        const serviceName = "Test Service";
        const expectedStatusCode = 200;
        const expectedResponse: PagerDutyServiceMetricsResponse = {
          metrics: [{
            service_id: serviceId,
            service_name: serviceName,
            total_high_urgency_incidents: 5,
            total_incident_count: 10,
            total_interruptions: 1,
          }]
        };

        mocked(fetch).mockReturnValue(mockedResponse(expectedStatusCode, {
          data: [{
            service_id: expectedResponse.metrics[0].service_id,
            service_name: expectedResponse.metrics[0].service_name,
            total_high_urgency_incidents: expectedResponse.metrics[0].total_high_urgency_incidents,
            total_incident_count: expectedResponse.metrics[0].total_incident_count,
            total_interruptions: expectedResponse.metrics[0].total_interruptions,
          }]
        }));

        const response = await request(app).get(`/services/${serviceId}/metrics`);

        const result: PagerDutyServiceMetricsResponse = JSON.parse(response.text);

        expect(response.status).toEqual(expectedStatusCode);
        expect(result).toEqual(expectedResponse);
      });

      it.each(testInputs)('returns BAD REQUEST when service id is not provided', async () => {
        const serviceId = '';

        const expectedStatusCode = 404;

        const response = await request(app).get(`/services/${serviceId}/metrics`);

        expect(response.status).toEqual(expectedStatusCode);
      });
    });

    describe('entity mappings', () => {
      it("returns a 400 if no serviceId is provided", async () => {
        const response = await request(app).post('/mapping/entity').send(JSON.stringify({}));
        expect(response.status).toEqual(400);
        expect(response.body).toEqual("Bad Request: 'serviceId' must be provided as part of the request body");
      });

      it("creates mapping reference dictionary from service-ids", async () => {
        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                    "pagerduty.com/service-id": "S3RV1CE1D",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },                    
                  ],
              },
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-2",
                    "pagerduty.com/service-id": "S3RV1CE2D",
                  },
                  "name": "ENTITY2",
                  "uid": "00000000-0000-4000-0000-000000000002",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER2",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER2",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER2" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const expectedReferenceDictionary: Record<string, { ref: string, name: string }> = {
          "S3RV1CE1D": { ref: "component:default/entity1", name: "ENTITY1" },
          "S3RV1CE2D": { ref: "component:default/entity2", name: "ENTITY2" },
        };

        const result = await createComponentEntitiesReferenceDict(mockEntitiesResponse);

        expect(result).toEqual(expectedReferenceDictionary);
      });

      it("creates mapping reference dictionary from integration keys", async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, {
          "services": [
            {
              "id": "S3RV1CE1D",
              "name": "Test Service 1",
              "description": "Test Service Description 1",
              "html_url": "https://example.pagerduty.com/services/S3RV1CE1D",
              "escalation_policy": {
                "id": "P0L1CY1D",
                "name": "Test Escalation Policy 1",
                "html_url": "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
              },
            }
          ]
        })
        );

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const expectedReferenceDictionary: Record<string, { ref: string, name: string }> = {
          "S3RV1CE1D": { ref: "component:default/entity1", name: "ENTITY1" },
        };

        const result = await createComponentEntitiesReferenceDict(mockEntitiesResponse);

        expect(result).toEqual(expectedReferenceDictionary);
      });

      it("ignores invalid integration keys when building entity mapping reference", async () => {
        mocked(fetch).mockReturnValue(mockedResponse(200, {"services": []}));

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const expectedReferenceDictionary: Record<string, { ref: string, name: string }> = {};

        const result = await createComponentEntitiesReferenceDict(mockEntitiesResponse);

        expect(result).toEqual(expectedReferenceDictionary);
      });

      it("builds entity mapping response for with InSync status when ONLY config mapping exists", async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [];

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                    "pagerduty.com/service-id": "S3RV1CE1D",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-2",
                    "pagerduty.com/service-id": "S3RV1CE2D",
                  },
                  "name": "ENTITY2",
                  "uid": "00000000-0000-4000-0000-000000000002",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER2",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER2",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER2" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const mockReferenceDictionary: Record<string, { ref: string, name: string }> = {
          "S3RV1CE1D": { ref: "component:default/entity1", name: "ENTITY1" },
          "S3RV1CE2D": { ref: "component:default/entity2", name: "ENTITY2" },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: "S3RV1CE1D",
            name: "Test Service 1",
            description: "Test Service Description 1",
            html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy 1",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M1D",
                type: "team_reference",
                summary: "Test Team 1",
                name: "Test Team 1",
                self: "https://example.pagerduty.com/teams/T34M1D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE1D",
                  "type": "service_reference",
                  "summary": "S3RV1CE1D",
                  "name": "S3RV1CE1D",
                  "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE1D",
                  escalation_policy: {
                    "id": "P0L1CY1D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 1",
                    "name": "Test Escalation Policy 1",
                    "self": "https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY1D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_1"
              }
            ],
            status: "active",
          },
          {
            id: "S3RV1CE2D",
            name: "Test Service 2",
            description: "Test Service Description 2",
            html_url: "https://example.pagerduty.com/services/S3RV1CE2D",
            escalation_policy: {
              id: "P0L1CY2D",
              name: "Test Escalation Policy 2",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M2D",
                type: "team_reference",
                summary: "Test Team 2",
                name: "Test Team 2",
                self: "https://example.pagerduty.com/teams/T34M2D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE2D",
                  "type": "service_reference",
                  "summary": "S3RV1CE2D",
                  "name": "S3RV1CE2D",
                  "self": "https://example.pagerduty.com/services/S3RV1CE2D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE2D",
                  escalation_policy: {
                    "id": "P0L1CY2D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 2",
                    "name": "Test Escalation Policy 2",
                    "self": "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY2D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_2"
              }
            ],
            status: "active",
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: "ENTITY1",
              entityRef: "component:default/entity1",
              escalationPolicy: "Test Escalation Policy 1",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_1",
              serviceId: "S3RV1CE1D",
              serviceName: "Test Service 1",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE1D",
              status: "InSync",
              team: "Test Team 1"
            },
            {
              entityName: "ENTITY2",
              entityRef: "component:default/entity2",
              escalationPolicy: "Test Escalation Policy 2",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_2",
              serviceId: "S3RV1CE2D",
              serviceName: "Test Service 2",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE2D",
              status: "InSync",
              team: "Test Team 2"
            }
          ]
        }

        const result = await buildEntityMappingsResponse(mockEntityMappings, mockReferenceDictionary, mockEntitiesResponse, mockPagerDutyServices);

        expect(result).toEqual(expectedResponse);

      });

      it("builds entity mapping response for with OutOfSync status when config mapping doesn't match database override", async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: "component:default/entity1",
            serviceId: "S3RV1CE1D",
            integrationKey: "BACKSTAGE_INTEGRATION_KEY_OVERRIDE_1",
            id: "1",
          }
        ];

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                    "pagerduty.com/service-id": "S3RV1CE1D",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-2",
                    "pagerduty.com/service-id": "S3RV1CE2D",
                  },
                  "name": "ENTITY2",
                  "uid": "00000000-0000-4000-0000-000000000002",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER2",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER2",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER2" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const mockReferenceDictionary: Record<string, { ref: string, name: string }> = {
          "S3RV1CE1D": { ref: "component:default/entity1", name: "ENTITY1" },
          "S3RV1CE2D": { ref: "component:default/entity2", name: "ENTITY2" },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: "S3RV1CE1D",
            name: "Test Service 1",
            description: "Test Service Description 1",
            html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy 1",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M1D",
                type: "team_reference",
                summary: "Test Team 1",
                name: "Test Team 1",
                self: "https://example.pagerduty.com/teams/T34M1D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE1D",
                  "type": "service_reference",
                  "summary": "S3RV1CE1D",
                  "name": "S3RV1CE1D",
                  "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE1D",
                  escalation_policy: {
                    "id": "P0L1CY1D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 1",
                    "name": "Test Escalation Policy 1",
                    "self": "https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY1D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_1"
              }
            ],
            status: "active",
          },
          {
            id: "S3RV1CE2D",
            name: "Test Service 2",
            description: "Test Service Description 2",
            html_url: "https://example.pagerduty.com/services/S3RV1CE2D",
            escalation_policy: {
              id: "P0L1CY2D",
              name: "Test Escalation Policy 2",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M2D",
                type: "team_reference",
                summary: "Test Team 2",
                name: "Test Team 2",
                self: "https://example.pagerduty.com/teams/T34M2D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE2D",
                  "type": "service_reference",
                  "summary": "S3RV1CE2D",
                  "name": "S3RV1CE2D",
                  "self": "https://example.pagerduty.com/services/S3RV1CE2D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE2D",
                  escalation_policy: {
                    "id": "P0L1CY2D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 2",
                    "name": "Test Escalation Policy 2",
                    "self": "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY2D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_2"
              }
            ],
            status: "active",
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: "ENTITY1",
              entityRef: "component:default/entity1",
              escalationPolicy: "Test Escalation Policy 1",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_OVERRIDE_1",
              serviceId: "S3RV1CE1D",
              serviceName: "Test Service 1",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE1D",
              status: "InSync",
              team: "Test Team 1"
            },
            {
              entityName: "ENTITY2",
              entityRef: "component:default/entity2",
              escalationPolicy: "Test Escalation Policy 2",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_2",
              serviceId: "S3RV1CE2D",
              serviceName: "Test Service 2",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE2D",
              status: "InSync",
              team: "Test Team 2"
            }
          ]
        }

        const result = await buildEntityMappingsResponse(mockEntityMappings, mockReferenceDictionary, mockEntitiesResponse, mockPagerDutyServices);

        expect(result).toEqual(expectedResponse);

      });

      it("builds entity mapping response with NotMapped status when config nor database entry exist", async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: "component:default/entity3",
            serviceId: "S3RV1CE3D",
            integrationKey: "BACKSTAGE_INTEGRATION_KEY_3",
            id: "1",
          }
        ];

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations": {},
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const mockReferenceDictionary: Record<string, { ref: string, name: string }> = {};

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: "S3RV1CE1D",
            name: "Test Service 1",
            description: "Test Service Description 1",
            html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy 1",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M1D",
                type: "team_reference",
                summary: "Test Team 1",
                name: "Test Team 1",
                self: "https://example.pagerduty.com/teams/T34M1D"
              }
            ],
            integrations: [],
            status: "active",
          },
          {
            id: "S3RV1CE2D",
            name: "Test Service 2",
            description: "Test Service Description 2",
            html_url: "https://example.pagerduty.com/services/S3RV1CE2D",
            escalation_policy: {
              id: "P0L1CY2D",
              name: "Test Escalation Policy 2",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M2D",
                type: "team_reference",
                summary: "Test Team 2",
                name: "Test Team 2",
                self: "https://example.pagerduty.com/teams/T34M2D"
              }
            ],
            integrations: [],
            status: "active",
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: "",
              entityRef: "",
              escalationPolicy: "Test Escalation Policy 1",
              integrationKey: "",
              serviceId: "S3RV1CE1D",
              serviceName: "Test Service 1",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE1D",
              status: "NotMapped",
              team: "Test Team 1"
            },
            {
              entityName: "",
              entityRef: "",
              escalationPolicy: "Test Escalation Policy 2",
              integrationKey: "",
              serviceId: "S3RV1CE2D",
              serviceName: "Test Service 2",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE2D",
              status: "NotMapped",
              team: "Test Team 2"
            }
          ]
        }

        const result = await buildEntityMappingsResponse(mockEntityMappings, mockReferenceDictionary, mockEntitiesResponse, mockPagerDutyServices);

        expect(result).toEqual(expectedResponse);

      });

      it("builds entity mapping response with InSync status when config mapping matches database override", async () => {
        const mockEntityMappings: RawDbEntityResultRow[] = [
          {
            entityRef: "component:default/entity1",
            serviceId: "S3RV1CE1D",
            integrationKey: "BACKSTAGE_INTEGRATION_KEY_1",
            id: "1",
          }
        ];

        const mockEntitiesResponse = {
          "items":
            [
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-1",
                    "pagerduty.com/service-id": "S3RV1CE1D",
                  },
                  "name": "ENTITY1",
                  "uid": "00000000-0000-4000-0000-000000000001",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER1",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER1",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER1" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
              {
                "metadata":
                {
                  "namespace": "default",
                  "annotations":
                  {
                    "pagerduty.com/integration-key": "PAGERDUTY-INTEGRATION-KEY-2",
                    "pagerduty.com/service-id": "S3RV1CE2D",
                  },
                  "name": "ENTITY2",
                  "uid": "00000000-0000-4000-0000-000000000002",
                },
                "apiVersion": "backstage.io/v1alpha1",
                "kind": "Component",
                "spec":
                {
                  "type": "website",
                  "lifecycle": "experimental",
                  "owner": "OWNER2",
                  "system": "SYSTEM1",
                },
                "relations":
                  [
                    {
                      "type": "ownedBy",
                      "targetRef": "group:default/OWNER2",
                      "target":
                        { "kind": "group", "namespace": "default", "name": "OWNER2" },
                    },
                    {
                      "type": "partOf",
                      "targetRef": "system:default/SYSTEM1",
                      "target":
                      {
                        "kind": "system",
                        "namespace": "default",
                        "name": "SYSTEM1",
                      },
                    },
                  ],
              },
            ],
        };

        const mockReferenceDictionary: Record<string, { ref: string, name: string }> = {
          "S3RV1CE1D": { ref: "component:default/entity1", name: "ENTITY1" },
          "S3RV1CE2D": { ref: "component:default/entity2", name: "ENTITY2" },
        };

        const mockPagerDutyServices: PagerDutyService[] = [
          {
            id: "S3RV1CE1D",
            name: "Test Service 1",
            description: "Test Service Description 1",
            html_url: "https://example.pagerduty.com/services/S3RV1CE1D",
            escalation_policy: {
              id: "P0L1CY1D",
              name: "Test Escalation Policy 1",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY1D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M1D",
                type: "team_reference",
                summary: "Test Team 1",
                name: "Test Team 1",
                self: "https://example.pagerduty.com/teams/T34M1D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE1D",
                  "type": "service_reference",
                  "summary": "S3RV1CE1D",
                  "name": "S3RV1CE1D",
                  "self": "https://api.eu.pagerduty.com/services/S3RV1CE1D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE1D",
                  escalation_policy: {
                    "id": "P0L1CY1D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 1",
                    "name": "Test Escalation Policy 1",
                    "self": "https://api.eu.pagerduty.com/escalation_policies/P0L1CY1D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY1D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_1"
              }
            ],
            status: "active",
          },
          {
            id: "S3RV1CE2D",
            name: "Test Service 2",
            description: "Test Service Description 2",
            html_url: "https://example.pagerduty.com/services/S3RV1CE2D",
            escalation_policy: {
              id: "P0L1CY2D",
              name: "Test Escalation Policy 2",
              html_url: "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
              type: "escalation_policy_reference",
            },
            teams: [
              {
                id: "T34M2D",
                type: "team_reference",
                summary: "Test Team 2",
                name: "Test Team 2",
                self: "https://example.pagerduty.com/teams/T34M2D"
              }
            ],
            integrations: [
              {
                "id": "P5M1NGD",
                "type": "app_event_transform_inbound_integration",
                "summary": "Backstage",
                "self": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "html_url": "https://example.pagerduty.com/services/S3RV1CE1D/integrations/P5M1NGD",
                "name": "Backstage",
                "service": {
                  "id": "S3RV1CE2D",
                  "type": "service_reference",
                  "summary": "S3RV1CE2D",
                  "name": "S3RV1CE2D",
                  "self": "https://example.pagerduty.com/services/S3RV1CE2D",
                  "html_url": "https://example.pagerduty.com/service-directory/S3RV1CE2D",
                  escalation_policy: {
                    "id": "P0L1CY2D",
                    "type": "escalation_policy_reference",
                    "summary": "Test Escalation Policy 2",
                    "name": "Test Escalation Policy 2",
                    "self": "https://example.pagerduty.com/escalation_policies/P0L1CY2D",
                    "html_url": "https://example.pagerduty.com/escalation-policies/P0L1CY2D"
                  }
                },
                "created_at": "2023-11-23T16:43:26Z",
                "vendor": {
                  "id": "PRO19CT",
                  "type": "vendor_reference",
                  "summary": "Backstage",
                  "self": "https://api.eu.pagerduty.com/vendors/PRO19CT",
                },
                "integration_key": "BACKSTAGE_INTEGRATION_KEY_2"
              }
            ],
            status: "active",
          },
        ];

        const expectedResponse: PagerDutyEntityMappingsResponse = {
          mappings: [
            {
              entityName: "ENTITY1",
              entityRef: "component:default/entity1",
              escalationPolicy: "Test Escalation Policy 1",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_1",
              serviceId: "S3RV1CE1D",
              serviceName: "Test Service 1",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE1D",
              status: "InSync",
              team: "Test Team 1"
            },
            {
              entityName: "ENTITY2",
              entityRef: "component:default/entity2",
              escalationPolicy: "Test Escalation Policy 2",
              integrationKey: "BACKSTAGE_INTEGRATION_KEY_2",
              serviceId: "S3RV1CE2D",
              serviceName: "Test Service 2",
              serviceUrl: "https://example.pagerduty.com/services/S3RV1CE2D",
              status: "InSync",
              team: "Test Team 2"
            }
          ]
        }

        const result = await buildEntityMappingsResponse(mockEntityMappings, mockReferenceDictionary, mockEntitiesResponse, mockPagerDutyServices);

        expect(result).toEqual(expectedResponse);

      });
    });
  });
});
