import { mockServices } from '@backstage/backend-test-utils';
import { createGetOnCallInformationAction } from './createGetOnCallInformationAction';
import { PagerDutyClient } from './PagerDutyClient';

jest.mock('./PagerDutyClient');

describe('createGetOnCallInformationAction', () => {
  let registeredAction: {
    name: string;
    action: (params: { input: { integrationKeys: string[] } }) => Promise<{
      output: { onCallInformation: Record<string, unknown> };
    }>;
  };

  const mockActionsRegistry = {
    register: jest.fn((action: typeof registeredAction) => {
      registeredAction = action;
    }),
  };

  const mockGetServiceByIntegrationKey = jest.fn();
  const mockGetOncalls = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (PagerDutyClient as jest.MockedClass<typeof PagerDutyClient>).mockImplementation(
      () =>
        ({
          getServiceByIntegrationKey: mockGetServiceByIntegrationKey,
          getOncalls: mockGetOncalls,
        }) as unknown as PagerDutyClient,
    );

    createGetOnCallInformationAction({
      actionsRegistry: mockActionsRegistry as any,
      discovery: mockServices.discovery(),
      auth: mockServices.auth(),
    });
  });

  it('should register the action with the correct name', () => {
    expect(mockActionsRegistry.register).toHaveBeenCalledTimes(1);
    expect(mockActionsRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'get-on-call-information',
      }),
    );
  });

  it('should resolve integration keys to on-call information', async () => {
    mockGetServiceByIntegrationKey.mockResolvedValue({
      id: 'S3RV1CE1D',
      name: 'Test Service',
      html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
      escalation_policy: {
        id: 'P0L1CY1D',
        name: 'Test Policy',
      },
    });

    mockGetOncalls.mockResolvedValue([
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
        escalation_policy: {
          id: 'P0L1CY1D',
          summary: 'Test Policy',
        },
      },
    ]);

    const result = await registeredAction.action({
      input: { integrationKeys: ['INT3GR4T10NK3Y'] },
    });

    expect(mockGetServiceByIntegrationKey).toHaveBeenCalledWith(
      'INT3GR4T10NK3Y',
    );
    expect(mockGetOncalls).toHaveBeenCalledWith('P0L1CY1D');

    expect(result).toEqual({
      output: {
        onCallInformation: {
          INT3GR4T10NK3Y: {
            service: {
              id: 'S3RV1CE1D',
              name: 'Test Service',
              html_url: 'https://example.pagerduty.com/services/S3RV1CE1D',
            },
            oncalls: [
              {
                user: {
                  name: 'John Doe',
                  email: 'john@example.com',
                  html_url: 'https://example.pagerduty.com/users/123',
                },
                escalation_level: 1,
                schedule: { summary: 'Primary On-Call' },
                escalation_policy: { summary: 'Test Policy' },
              },
            ],
          },
        },
      },
    });
  });

  it('should handle multiple integration keys', async () => {
    mockGetServiceByIntegrationKey
      .mockResolvedValueOnce({
        id: 'SVC1',
        name: 'Service 1',
        html_url: 'https://example.pagerduty.com/services/SVC1',
        escalation_policy: { id: 'POL1' },
      })
      .mockResolvedValueOnce({
        id: 'SVC2',
        name: 'Service 2',
        html_url: 'https://example.pagerduty.com/services/SVC2',
        escalation_policy: { id: 'POL2' },
      });

    mockGetOncalls
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          user: {
            id: 'u1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            html_url: 'https://example.pagerduty.com/users/456',
            summary: 'Jane Doe',
            avatar_url: 'https://example.pagerduty.com/avatars/456',
          },
          escalation_level: 1,
          schedule: undefined,
          escalation_policy: undefined,
        },
      ]);

    const result = await registeredAction.action({
      input: { integrationKeys: ['KEY1', 'KEY2'] },
    });

    expect(mockGetServiceByIntegrationKey).toHaveBeenCalledTimes(2);
    expect(mockGetOncalls).toHaveBeenCalledTimes(2);

    const info = result.output.onCallInformation;
    expect(info['KEY1']).toEqual({
      service: {
        id: 'SVC1',
        name: 'Service 1',
        html_url: 'https://example.pagerduty.com/services/SVC1',
      },
      oncalls: [],
    });
    expect(info['KEY2']).toEqual({
      service: {
        id: 'SVC2',
        name: 'Service 2',
        html_url: 'https://example.pagerduty.com/services/SVC2',
      },
      oncalls: [
        {
          user: {
            name: 'Jane Doe',
            email: 'jane@example.com',
            html_url: 'https://example.pagerduty.com/users/456',
          },
          escalation_level: 1,
          schedule: undefined,
          escalation_policy: undefined,
        },
      ],
    });
  });
});
