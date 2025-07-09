import { mocked } from 'jest-mock';
import { mockServices } from '@backstage/backend-test-utils';
import { Config } from '@backstage/config';
import { getAuthToken, loadAuthConfig } from './auth';
import { RootConfigService } from '@backstage/backend-plugin-api';

global.fetch = jest.fn() as jest.Mock;

function mockedResponse(status: number, body: any): Promise<Response> {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    status,
  } as Response);
}

describe('PagerDuty Auth', () => {
  const logger = mockServices.rootLogger();
  let config: RootConfigService;
  let legacyConfig: Config;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getAuthToken', () => {
    beforeEach(() => {
      config = mockServices.rootConfig({
        data: {
          pagerDuty: {
            oauth: {
              clientId: 'test-client-id',
              clientSecret: 'test-client-secret',
              subDomain: 'test',
              region: 'us',
            },
          },
        },
      });

      legacyConfig = {
        getOptional: jest.fn(),
        getOptionalString: jest.fn(),
        getOptionalNumber: jest.fn(),
        getOptionalBoolean: jest.fn(),
        getOptionalConfig: jest.fn(),
        getOptionalConfigArray: jest.fn(),
        getOptionalStringArray: jest.fn(),
        get: jest.fn(),
        getString: jest.fn(),
        getNumber: jest.fn(),
        getBoolean: jest.fn(),
        getConfig: jest.fn(),
        getConfigArray: jest.fn(),
        getStringArray: jest.fn(),
        has: jest.fn(),
        keys: jest.fn(),
      };
    });

    it('should get token with OAuth config', async () => {
      mocked(fetch).mockReturnValue(
        mockedResponse(200, {
          access_token: 'oauth-token-value',
          token_type: 'bearer',
          expires_in: 86400,
        }),
      );

      jest.setSystemTime(new Date(2025, 3, 9, 12, 0, 0)); // April 9, 2025 12:00:00

      await loadAuthConfig({
        config,
        legacyConfig,
        logger,
      });

      const result = await getAuthToken();

      expect(result).toEqual('Bearer oauth-token-value');
      expect(fetch).toHaveBeenCalled();
    });

    it('should refresh expired OAuth token', async () => {
      // First call returns the initial token, second call returns the refreshed token
      mocked(fetch)
        .mockReturnValueOnce(
          mockedResponse(200, {
            access_token: 'initial-token',
            token_type: 'bearer',
            expires_in: 86400, // Expires in 24 hours
          }),
        )
        .mockReturnValueOnce(
          mockedResponse(200, {
            access_token: 'refreshed-token',
            token_type: 'bearer',
            expires_in: 86400,
          }),
        );

      jest.setSystemTime(new Date(2025, 3, 9, 12, 0, 0)); // April 9, 2025 12:00:00

      await loadAuthConfig({
        config,
        legacyConfig,
        logger,
      });

      const initialToken = await getAuthToken();
      expect(initialToken).toEqual('Bearer initial-token');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Advance time past token expiry
      jest.setSystemTime(new Date(2025, 3, 10, 13, 0, 0)); // April 10, 2025 13:00:00 (> 24 hours later)

      const refreshedToken = await getAuthToken();
      expect(refreshedToken).toEqual('Bearer refreshed-token');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should get token for specific account', async () => {
      config = mockServices.rootConfig({
        data: {
          pagerDuty: {
            accounts: [
              {
                id: 'test-account',
                apiToken: 'test-api-token',
                isDefault: true,
              },
              {
                id: 'second-account',
                apiToken: 'second-api-token',
              },
            ],
          },
        },
      });

      await loadAuthConfig({
        config,
        legacyConfig,
        logger,
      });

      const defaultToken = await getAuthToken();
      expect(defaultToken).toEqual('Token token=test-api-token');

      const specificToken = await getAuthToken('second-account');
      expect(specificToken).toEqual('Token token=second-api-token');
    });

    it('should return empty string for unknown account', async () => {
      config = mockServices.rootConfig({
        data: {
          pagerDuty: {
            accounts: [
              {
                id: 'test-account',
                apiToken: 'test-api-token',
              },
            ],
          },
        },
      });

      await loadAuthConfig({
        config,
        legacyConfig,
        logger,
      });

      const result = await getAuthToken('unknown-account');
      expect(result).toEqual('');
    });

    it('should use legacy API token config', async () => {
      const mockGetOptionalString = jest.fn(key => {
        if (key === 'pagerDuty.apiToken') {
          return 'legacy-api-token';
        }
        return undefined;
      });

      legacyConfig = {
        ...legacyConfig,
        getOptionalString: mockGetOptionalString,
        has: jest.fn().mockReturnValue(true),
      };

      await loadAuthConfig({
        config: undefined,
        legacyConfig,
        logger,
      });

      const result = await getAuthToken();
      expect(result).toEqual('Token token=legacy-api-token');
    });
  });
});
