import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import fetch from 'node-fetch';
import { PagerDutyClient } from './client';

jest.mock('node-fetch');

const mockedFetch = fetch as unknown as jest.Mock;

const entityRef = 'component:default/some-service';

function respond(status: number, body: string) {
  mockedFetch.mockResolvedValueOnce({
    status,
    ok: status < 400,
    text: async () => body,
    json: async () => JSON.parse(body),
  });
}

describe('PagerDutyClient.getServiceIdAnnotationFromCatalog', () => {
  const client = new PagerDutyClient({
    auth: {
      getOwnServiceCredentials: async () => ({}),
      getPluginRequestToken: async () => ({ token: 'token' }),
    } as unknown as AuthService,
    discovery: {
      getBaseUrl: async () => 'http://localhost:7007/api/pagerduty',
    } as unknown as DiscoveryService,
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as LoggerService,
  });

  beforeEach(() => mockedFetch.mockReset());

  it('returns an empty string for a 200 with an empty body', async () => {
    respond(200, '');
    await expect(
      client.getServiceIdAnnotationFromCatalog(entityRef),
    ).resolves.toBe('');
  });

  it('returns an empty string for a 404', async () => {
    respond(404, '');
    await expect(
      client.getServiceIdAnnotationFromCatalog(entityRef),
    ).resolves.toBe('');
  });

  it('returns the service id from a JSON body', async () => {
    respond(200, '"PABC123"');
    await expect(
      client.getServiceIdAnnotationFromCatalog(entityRef),
    ).resolves.toBe('PABC123');
  });

  it('rejects on a 400', async () => {
    respond(400, 'Bad Request');
    await expect(
      client.getServiceIdAnnotationFromCatalog(entityRef),
    ).rejects.toThrow(/Failed to retrieve a PagerDuty service id/);
  });
});
