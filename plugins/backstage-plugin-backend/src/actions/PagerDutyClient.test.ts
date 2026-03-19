import { mockServices } from '@backstage/backend-test-utils';
import { PagerDutyClient } from './PagerDutyClient';

const mockDiscovery = mockServices.discovery();
const mockAuth = mockServices.auth();

describe('PagerDutyClient', () => {
  let client: PagerDutyClient;

  beforeEach(() => {
    client = new PagerDutyClient({
      discovery: mockDiscovery,
      auth: mockAuth,
    });
    jest.clearAllMocks();
  });

  describe('getServiceByIntegrationKey', () => {
    it('should fetch a service by integration key', async () => {
      const mockService = {
        id: 'S3RV1CE1D',
        name: 'Test Service',
        html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
        escalation_policy: {
          id: 'P0L1CY1D',
          name: 'Test Policy',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ service: mockService }),
      });

      const result = await client.getServiceByIntegrationKey('INT3GR4T10NK3Y');

      expect(result).toEqual(mockService);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/services?integration_key=INT3GR4T10NK3Y'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer '),
          }),
        }),
      );
    });

    it('should throw when the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(
        client.getServiceByIntegrationKey('bad-key'),
      ).rejects.toThrow(
        'Failed to get service for integration key bad-key: Not Found',
      );
    });
  });

  describe('getOncalls', () => {
    it('should fetch oncalls for an escalation policy', async () => {
      const mockOncalls = [
        {
          user: {
            id: 'userId1',
            name: 'John Doe',
            email: 'john@example.com',
            html_url: 'https://example.pagerduty.com/users/123',
            summary: 'John Doe',
            avatar_url: 'https://example.pagerduty.com/avatars/123',
          },
          escalation_level: 1,
          schedule: {
            id: 'SCHED1',
            summary: 'Primary On-Call',
          },
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ oncalls: mockOncalls }),
      });

      const result = await client.getOncalls('P0L1CY1D');

      expect(result).toEqual(mockOncalls);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oncalls?escalation_policy_ids=P0L1CY1D'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer '),
          }),
        }),
      );
    });

    it('should throw when the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(client.getOncalls('bad-policy')).rejects.toThrow(
        'Failed to get oncalls for escalation policy bad-policy: Unauthorized',
      );
    });
  });
});
