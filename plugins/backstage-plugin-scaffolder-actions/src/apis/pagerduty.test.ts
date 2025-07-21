/* eslint-disable jest/no-conditional-expect */
import { PagerDutyAccountConfig } from '@pagerduty/backstage-plugin-common';
import {
  createService,
  createServiceIntegration,
  getAccountByEscalationPolicyId,
  insertEndpointConfig,
  setFallbackEndpointConfig,
} from './pagerduty';

import { mocked } from 'jest-mock';
import fetch, { Response } from 'node-fetch';

jest.mock('node-fetch');

jest.mock('../auth/auth', () => ({
  getAuthToken: jest.fn().mockReturnValue(Promise.resolve('test-token')),
  loadAuthConfig: jest.fn().mockReturnValue(Promise.resolve()),
}));

const testInputs = ['apiToken', 'oauth'];

function mockedResponse(status: number, body: any): Promise<Response> {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    status,
  } as Response);
}

describe('PagerDuty API', () => {
  beforeAll(() => {
    const mockAccount: PagerDutyAccountConfig = {
      id: 'testaccount',
      apiBaseUrl: 'https://mock.api.pagerduty.com',
      eventsBaseUrl: 'https://mock.events.pagerduty.com',
    };

    insertEndpointConfig(mockAccount);
    setFallbackEndpointConfig(mockAccount);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createService', () => {
    it.each(testInputs)(
      'should create a service without event grouping when AIOps is not available',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '12345';

        const expectedResponse = {
          alertGrouping: 'null',
          id: 'S3RV1CE1D',
          url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
        };

        mocked(fetch)
          .mockReturnValueOnce(mockedResponse(200, { abilities: [] }))
          .mockReturnValueOnce(
            mockedResponse(201, {
              service: {
                id: 'S3RV1CE1D',
                html_url:
                  'https://testaccount.pagerduty.com/services/S3RV1CE1D',
              },
            }),
          );

        const result = await createService({
          name,
          description,
          escalationPolicyId,
          alertGrouping: 'intelligent',
        });

        expect(result).toEqual(expectedResponse);
        expect(fetch).toHaveBeenCalledTimes(2);
      },
    );

    it.each(testInputs)(
      "should create a service without event grouping when grouping is 'null'",
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '12345';

        const expectedResponse = {
          alertGrouping: 'null',
          id: 'S3RV1CE1D',
          url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
        };

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(
            mockedResponse(201, {
              service: {
                id: 'S3RV1CE1D',
                html_url:
                  'https://testaccount.pagerduty.com/services/S3RV1CE1D',
              },
            }),
          );

        const result = await createService({
          name,
          description,
          escalationPolicyId,
          alertGrouping: 'null',
        });

        expect(result).toEqual(expectedResponse);
        expect(fetch).toHaveBeenCalledTimes(2);
      },
    );

    it.each(testInputs)(
      'should create a service without event grouping when grouping is undefined',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '12345';

        const expectedResponse = {
          alertGrouping: 'null',
          id: 'S3RV1CE1D',
          url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
        };

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(
            mockedResponse(201, {
              service: {
                id: 'S3RV1CE1D',
                html_url:
                  'https://testaccount.pagerduty.com/services/S3RV1CE1D',
              },
            }),
          );

        const result = await createService({
          name,
          description,
          escalationPolicyId,
        });

        expect(result).toEqual(expectedResponse);
        expect(fetch).toHaveBeenCalledTimes(2);
      },
    );

    it.each(testInputs)('should create a service', async () => {
      const name = 'TestService';
      const description = 'Test Service Description';
      const escalationPolicyId = '12345';

      const expectedResponse = {
        alertGrouping: 'null',
        id: 'S3RV1CE1D',
        url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
      };

      mocked(fetch)
        .mockReturnValueOnce(
          mockedResponse(200, {
            abilities: [
              'preview_intelligent_alert_grouping',
              'time_based_alert_grouping',
            ],
          }),
        )
        .mockReturnValueOnce(
          mockedResponse(201, {
            service: {
              id: 'S3RV1CE1D',
              html_url: 'https://testaccount.pagerduty.com/services/S3RV1CE1D',
            },
          }),
        );

      const result = await createService({
        name,
        description,
        escalationPolicyId,
      });

      expect(result).toEqual(expectedResponse);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each(testInputs)(
      'should NOT create a service when caller provides invalid arguments',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '';

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(mockedResponse(400, {}));

        try {
          await createService({ name, description, escalationPolicyId });
        } catch (error) {
          expect((error as Error).message).toEqual(
            'Failed to create service. Caller provided invalid arguments.',
          );
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service when correct credentials are not provided',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '';

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(mockedResponse(401, {}));

        try {
          await createService({ name, description, escalationPolicyId });
        } catch (error) {
          expect((error as Error).message).toEqual(
            'Failed to create service. Caller did not supply credentials or did not provide the correct credentials.',
          );
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service when account does not have abilities to perform the action',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '12345';

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(mockedResponse(402, {}));

        try {
          await createService({ name, description, escalationPolicyId });
        } catch (error) {
          expect((error as Error).message).toEqual(
            'Failed to create service. Account does not have the abilities to perform the action.',
          );
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service when user is not allowed to view the requested resource',
      async () => {
        const name = 'TestService';
        const description = 'Test Service Description';
        const escalationPolicyId = '12345';

        mocked(fetch)
          .mockReturnValueOnce(
            mockedResponse(200, {
              abilities: [
                'preview_intelligent_alert_grouping',
                'time_based_alert_grouping',
              ],
            }),
          )
          .mockReturnValueOnce(mockedResponse(403, {}));

        try {
          await createService({ name, description, escalationPolicyId });
        } catch (error) {
          expect((error as Error).message).toEqual(
            'Failed to create service. Caller is not authorized to view the requested resource.',
          );
        }
      },
    );

    it.each(testInputs)(
      'should get account from escalation policy id',
      async () => {
        const escalationPolicyId = '12345';

        mocked(fetch).mockReturnValueOnce(
          mockedResponse(200, {
            escalation_policies: [
              {
                id: '12345',
                name: 'Test Escalation Policy',
                summary: 'Test Escalation Policy Summary',
                type: 'escalation_policy',
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
            more: false,
          }),
        );

        const account =
          await getAccountByEscalationPolicyId(escalationPolicyId);

        expect(account).toEqual('testaccount');
        expect(fetch).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('createServiceIntegration', () => {
    it.each(testInputs)('should create a service integration', async () => {
      const serviceId = 'serviceId';
      const vendorId = 'vendorId';

      const expectedResponse = 'integrationId';

      mocked(fetch).mockReturnValue(
        mockedResponse(201, {
          integration: { integration_key: expectedResponse },
        }),
      );

      const result = await createServiceIntegration({ serviceId, vendorId });

      expect(result).toEqual(expectedResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each(testInputs)(
      'should NOT create a service integration when caller provides invalid arguments',
      async () => {
        const serviceId = 'serviceId';
        const vendorId = 'nonExistentVendorId';

        global.fetch = jest.fn(() =>
          Promise.resolve({
            status: 400,
          }),
        ) as jest.Mock;

        const expectedErrorMessage =
          'Failed to create service integration. Caller provided invalid arguments.';

        try {
          await createServiceIntegration({ serviceId, vendorId });
        } catch (error) {
          expect((error as Error).message).toEqual(expectedErrorMessage);
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service integration when correct credentials are not provided',
      async () => {
        const serviceId = 'serviceId';
        const vendorId = 'nonExistentVendorId';

        mocked(fetch).mockReturnValue(mockedResponse(401, {}));

        const expectedErrorMessage =
          'Failed to create service integration. Caller did not supply credentials or did not provide the correct credentials.';

        try {
          await createServiceIntegration({ serviceId, vendorId });
        } catch (error) {
          expect((error as Error).message).toEqual(expectedErrorMessage);
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service integration when user is not allowed to view the requested resource',
      async () => {
        const serviceId = 'serviceId';
        const vendorId = 'nonExistentVendorId';

        mocked(fetch).mockReturnValue(mockedResponse(403, {}));

        const expectedErrorMessage =
          'Failed to create service integration. Caller is not authorized to view the requested resource.';

        try {
          await createServiceIntegration({ serviceId, vendorId });
        } catch (error) {
          expect((error as Error).message).toEqual(expectedErrorMessage);
        }
      },
    );

    it.each(testInputs)(
      'should NOT create a service integration when request rate limit is exceeded',
      async () => {
        const serviceId = 'serviceId';
        const vendorId = 'nonExistentVendorId';

        mocked(fetch).mockReturnValue(mockedResponse(429, {}));

        const expectedErrorMessage =
          'Failed to create service integration. Rate limit exceeded.';

        try {
          await createServiceIntegration({ serviceId, vendorId });
        } catch (error) {
          expect((error as Error).message).toEqual(expectedErrorMessage);
        }
      },
    );
  });
});
