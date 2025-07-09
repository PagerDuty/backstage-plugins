import { mocked } from "jest-mock";
import { mockServices } from '@backstage/backend-test-utils';

import { getAuthToken, loadAuthConfig } from './auth';
import { RootConfigService } from "@backstage/backend-plugin-api";

global.fetch = jest.fn() as jest.Mock;

function mockedResponse(status: number, body: any): Promise<Response> {
  return Promise.resolve({
      json: () => Promise.resolve(body),
      status
  } as Response);
}

describe('PagerDuty Auth', () => {
  const logger = mockServices.rootLogger();
  let config : RootConfigService;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  describe('getAuthToken', () => {
      config = mockServices.rootConfig({
        data: {
          pagerDuty: {
            oauth: {
              clientId: 'foobar',
              clientSecret: 'super-secret-wow',
              subDomain: 'EU',
            }

          }
        }
      });

      it('Get token with legacy OAuth config', async () => {
        mocked(fetch).mockReturnValue(
          mockedResponse(200, { access_token: 'sometoken', token_type: "bearer", expires_in: 86400 })
        );
        jest.setSystemTime(new Date(2024, 9, 1, 9, 0));
        await loadAuthConfig(config, logger);
  
        const result = await getAuthToken();
        expect(result).toEqual('Bearer sometoken');
      });

      it('Get token with account OAuth config', async () => {
        config = mockServices.rootConfig({
          data: {
            pagerDuty: {
              accounts: [
                {
                  id: 'test1',
                  oauth: {
                    clientId: 'foobar',
                    clientSecret: 'super-secret-wow',
                    subDomain: 'EU',
                  }
                }
              ]
            }
          }
        });
        mocked(fetch).mockReturnValue(
          mockedResponse(200, { access_token: 'sometoken', token_type: "bearer", expires_in: 86400 })
        );
        jest.setSystemTime(new Date(2024, 9, 1, 9, 0));
        await loadAuthConfig(config, logger);
  
        const defaultResult = await getAuthToken();
        expect(defaultResult).toEqual('Bearer sometoken');
        const accountResult = await getAuthToken('test1');
        expect(accountResult).toEqual('Bearer sometoken');
      });

      it('Get refreshed token with legacy OAuth config', async () => {
        mocked(fetch).mockReturnValueOnce(
          mockedResponse(200, { access_token: 'sometoken1', token_type: "bearer", expires_in: 86400 })
        );
        mocked(fetch).mockReturnValueOnce(
          mockedResponse(200, { access_token: 'sometoken2', token_type: "bearer", expires_in: 86400 })
        );
        jest.setSystemTime(new Date(2024, 9, 1, 9, 0));
        await loadAuthConfig(config, logger);
  
        const before = await getAuthToken();
        expect(before).toEqual('Bearer sometoken1');
  
        jest.setSystemTime(new Date(2024, 9, 2, 9, 1));
        const result = await getAuthToken();
        expect(result).toEqual('Bearer sometoken2');
      });

      it('Get legacy token', async () => {
        config = mockServices.rootConfig({
          data: {
            pagerDuty: {
              apiToken: 'some-api-token',
            }
          }
        });
        await loadAuthConfig(config, logger);
  
        const result = await getAuthToken();
        expect(result).toEqual('Token token=some-api-token');
      });

      it('Get account token', async () => {
        config = mockServices.rootConfig({
          data: {
            pagerDuty: {
              accounts: [
                {
                  id: 'test2',
                  apiToken: 'some-api-token',
                }
              ]
            }
          }
        });
        await loadAuthConfig(config, logger);
  
        const defaultResult = await getAuthToken();
        expect(defaultResult).toEqual('Token token=some-api-token');
        const accountResult = await getAuthToken('test2');
        expect(accountResult).toEqual('Token token=some-api-token');
        const noResult = await getAuthToken('test1');
        expect(noResult).toEqual('');
      });
  });
});
