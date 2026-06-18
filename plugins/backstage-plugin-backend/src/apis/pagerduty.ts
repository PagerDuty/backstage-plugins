import fetch from 'node-fetch';
import type { RequestInit, Response } from 'node-fetch';

import { getAuthToken } from '../auth/auth';

import {
  PagerDutyServiceResponse,
  PagerDutyServicesResponse,
  PagerDutyEscalationPolicy,
  PagerDutyEscalationPoliciesResponse,
  PagerDutyAbilitiesResponse,
  PagerDutyOnCallsResponse,
  PagerDutyUser,
  PagerDutyService,
  PagerDutyChangeEventsResponse,
  PagerDutyChangeEvent,
  PagerDutyIncident,
  PagerDutyIncidentsResponse,
  PagerDutyServiceStandards,
  PagerDutyServiceMetrics,
  HttpError,
  PagerDutyServicesAPIResponse,
  PagerDutyAccountConfig,
  PagerDutyIntegrationResponse,
  PagerDutyServiceDependency,
  PagerDutyServiceDependencyResponse,
  PagerDutyTeam,
  PagerDutyTeamsResponse,
  PagerDutyCustomFieldCreateRequest,
  PagerDutyCustomFieldResponse,
  PagerDutyCustomFieldsResponse,
  PagerDutyCustomFieldUpdateRequest,
  PagerDutyServiceCustomFieldValuesRequest,
  PagerDutyServiceCustomFieldValuesResponse,
} from '@pagerduty/backstage-plugin-common';

import { DateTime } from 'luxon';
import {
  CacheService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';

export type PagerDutyEndpointConfig = {
  eventsBaseUrl: string;
  apiBaseUrl: string;
};

const EndpointConfig: Record<string, PagerDutyEndpointConfig> = {};
let fallbackEndpointConfig: PagerDutyEndpointConfig;
let isLegacyConfig = false;

const SubdomainConfig: Record<string, string> = {};
let fallbackSubdomain: string | undefined;

export function setFallbackAccountConfig(account: PagerDutyAccountConfig) {
  fallbackEndpointConfig = {
    eventsBaseUrl: account.eventsBaseUrl ?? 'https://events.pagerduty.com/v2',
    apiBaseUrl: account.apiBaseUrl ?? 'https://api.pagerduty.com',
  };

  if (account.oauth?.subDomain) {
    fallbackSubdomain = account.oauth.subDomain;
  }
}

export function insertAccountConfig(account: PagerDutyAccountConfig) {
  EndpointConfig[account.id] = {
    eventsBaseUrl: account.eventsBaseUrl ?? 'https://events.pagerduty.com/v2',
    apiBaseUrl: account.apiBaseUrl ?? 'https://api.pagerduty.com',
  };

  if (account.oauth?.subDomain) {
    SubdomainConfig[account.id] = account.oauth.subDomain;
  }
}

export function loadPagerDutyEndpointsFromConfig(
  config: RootConfigService,
  logger: LoggerService,
) {
  const accounts = config.getOptional<PagerDutyAccountConfig[]>('pagerDuty.accounts');

  if (accounts) {
    logger.debug(
      `New accounts configuration detected. Loading PagerDuty endpoints from config.`,
    );
    isLegacyConfig = false;

    if (accounts?.length === 1) {
      logger.debug(
        `Single account configuration detected. Loading PagerDuty endpoints from config to 'default'.`,
      );
      EndpointConfig.default = {
        eventsBaseUrl:
          accounts[0].eventsBaseUrl !== undefined
            ? accounts[0].eventsBaseUrl
            : 'https://events.pagerduty.com/v2',
        apiBaseUrl:
          accounts[0].apiBaseUrl !== undefined
            ? accounts[0].apiBaseUrl
            : 'https://api.pagerduty.com',
      };

      if (accounts[0].oauth?.subDomain) {
        SubdomainConfig.default = accounts[0].oauth.subDomain;
      }
    } else {
      logger.debug(
        `Multiple account configuration detected. Loading PagerDuty endpoints from config.`,
      );
      accounts?.forEach(account => {
        if (account.isDefault) {
          setFallbackAccountConfig(account);
        }

        insertAccountConfig(account);
      });
    }
  } else {
    logger.debug(`Loading legacy PagerDuty endpoints from config.`);
    isLegacyConfig = true;

    EndpointConfig.default = {
      eventsBaseUrl:
        config.getOptionalString('pagerDuty.eventsBaseUrl') !== undefined
          ? config.getString('pagerDuty.eventsBaseUrl')
          : 'https://events.pagerduty.com/v2',
      apiBaseUrl:
        config.getOptionalString('pagerDuty.apiBaseUrl') !== undefined
          ? config.getString('pagerDuty.apiBaseUrl')
          : 'https://api.pagerduty.com',
    };

    const legacySubdomain = config.getOptionalString('pagerDuty.oauth.subDomain');

    if (legacySubdomain) {
      SubdomainConfig.default = legacySubdomain;
    }
  }
}

function getApiBaseUrl(account?: string): string {
  if (isLegacyConfig === true) {
    return EndpointConfig.default.apiBaseUrl;
  }

  if (account) {
    return EndpointConfig[account].apiBaseUrl;
  }

  return fallbackEndpointConfig.apiBaseUrl;
}

function getSubdomain(account?: string): string {
  if (isLegacyConfig === true) {
    return SubdomainConfig.default;
  }

  if (account && account !== 'default') {
    return SubdomainConfig[account] ?? fallbackSubdomain ?? SubdomainConfig.default;
  }

  return fallbackSubdomain ?? SubdomainConfig.default;
}

async function getDefaultHeaders(account?: string): Promise<Record<string, string>> {
  const subdomain = getSubdomain(account);
  const clientHeader = `"Backstage" <https://${subdomain}.backstage.com>`;

  return {
    Authorization: await getAuthToken(account),
    Accept: 'application/vnd.pagerduty+json;version=2',
    'Content-Type': 'application/json',
    'X-PagerDuty-Client': clientHeader,
  };
}

// Caching for PagerDuty services. A full fetch is cached as a list, and each
// service is also indexed by id so single-service lookups can be served from
// the cache without hitting the API again.
const SERVICES_CACHE_TTL_MS = 20 * 60 * 1000;
const ALL_SERVICES_CACHE_KEY = 'pagerduty:services:all';

// Normalize the account segment so callers that pass an empty string (e.g. the
// frontend bulk-mapping payload) hit the same key as the full-fetch indexer,
// which stores services under the EndpointConfig key ('default' for single
// account setups).
const serviceCacheKey = (serviceId: string, account?: string) =>
  `pagerduty:service:${account || 'default'}:${serviceId}`;

async function readCache<T>(
  cache: CacheService | undefined,
  key: string,
): Promise<T | undefined> {
  if (!cache) {
    return undefined;
  }
  return (await cache.get(key)) as T | undefined;
}

async function writeCache(
  cache: CacheService | undefined,
  key: string,
  value: unknown,
): Promise<void> {
  if (!cache) {
    return;
  }
  await cache.set(
    key,
    value as Parameters<CacheService['set']>[1],
    { ttl: SERVICES_CACHE_TTL_MS },
  );
}

// Supporting router
export async function addServiceRelationsToService(
  serviceRelations: PagerDutyServiceDependency[],
  account?: string,
): Promise<PagerDutyServiceDependency[]> {
  let response: Response;
  const options: RequestInit = {
    method: 'POST',
    headers: await getDefaultHeaders(account),
    body: JSON.stringify({
      relationships: serviceRelations,
    }),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/associate`;

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to add service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to add service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to add service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to add service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to add service dependencies. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServiceDependencyResponse;
  try {
    result = await response.json();

    return result.relationships;
  } catch (error) {
    throw new HttpError(
      `Failed to parse service dependency information: ${error}`,
      500,
    );
  }
}

export async function removeServiceRelationsFromService(
  serviceRelations: PagerDutyServiceDependency[],
  account?: string,
): Promise<PagerDutyServiceDependency[]> {
  let response: Response;
  const options: RequestInit = {
    method: 'POST',
    headers: await getDefaultHeaders(account),
    body: JSON.stringify({
      relationships: serviceRelations,
    }),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/disassociate`;

  try {
    response = await fetchWithRetries(`${baseUrl}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to remove service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to remove service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to remove service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to remove service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to remove service dependencies. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServiceDependencyResponse;
  try {
    result = await response.json();

    return result.relationships;
  } catch (error) {
    throw new HttpError(
      `Failed to parse service dependency information: ${error}`,
      500,
    );
  }
}

export async function getServiceRelationshipsById(
  serviceId: string,
  account?: string,
): Promise<PagerDutyServiceDependency[]> {
  let response: Response;
  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/technical_services/${encodeURIComponent(serviceId)}`;

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to list service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to list service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to list service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to list service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to list service dependencies. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServiceDependencyResponse;
  try {
    result = await response.json();

    return result.relationships;
  } catch (error) {
    throw new HttpError(
      `Failed to parse service dependency information: ${error}`,
      500,
    );
  }
}

async function getEscalationPolicies(
  offset: number,
  limit: number,
  account?: string,
): Promise<[boolean, PagerDutyEscalationPolicy[]]> {
  let response: Response;
  const params = `total=true&sort_by=name&offset=${offset}&limit=${limit}`;
  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/escalation_policies`;

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve escalation policies: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to list escalation policies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to list escalation policies. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to list escalation policies. Caller is not authorized to view the requested resource.',
        403,
      );
    case 429:
      throw new HttpError(
        'Failed to list escalation policies. Rate limit exceeded.',
        429,
      );
    default: // 200
      break;
  }

  let result: PagerDutyEscalationPoliciesResponse;
  try {
    result = (await response.json()) as PagerDutyEscalationPoliciesResponse;

    return [result.more ?? false, result.escalation_policies];
  } catch (error) {
    throw new HttpError(
      `Failed to parse escalation policy information: ${error}`,
      500,
    );
  }
}

export async function getAllEscalationPolicies(): Promise<
  PagerDutyEscalationPolicy[]
> {
  const limit = 50;
  let offset = 0;
  let moreResults = false;
  let results: PagerDutyEscalationPolicy[] = [];

  await Promise.all(
    Object.keys(EndpointConfig).map(async account => {
      try {
        // reset offset value
        offset = 0;

        do {
          const res = await getEscalationPolicies(offset, limit, account);

          // set account for each escalation policy
          res[1].forEach(policy => {
            policy.account = account;
          });

          // update results
          results = results.concat(res[1]);

          // if more results exist
          if (res[0] === true) {
            moreResults = true;
            offset += limit;
          } else {
            moreResults = false;
          }
        } while (moreResults === true);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        } else {
          throw new HttpError(`${error}`, 500);
        }
      }
    }),
  );

  return results;
}

async function getTeams(
  offset: number,
  limit: number,
  account?: string,
): Promise<[boolean, PagerDutyTeam[]]> {
  let response: Response;
  const params = `total=true&sort_by=name&offset=${offset}&limit=${limit}`;
  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/teams`;

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve teams: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to list teams. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to list teams. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to list teams. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to list teams. Caller is not authorized to view the requested resource.',
        403,
      );
    case 429:
      throw new HttpError('Failed to list teams. Rate limit exceeded.', 429);
    default: // 200
      break;
  }

  let result: PagerDutyTeamsResponse;
  try {
    result = (await response.json()) as PagerDutyTeamsResponse;

    return [result.more ?? false, result.teams];
  } catch (error) {
    throw new HttpError(`Failed to parse team information: ${error}`, 500);
  }
}

export async function getAllTeams(account?: string): Promise<PagerDutyTeam[]> {
  const limit = 50;
  let offset = 0;
  let moreResults = false;
  let results: PagerDutyTeam[] = [];

  const accountsToFetch = account ? [account] : Object.keys(EndpointConfig);

  await Promise.all(
    accountsToFetch.map(async acc => {
      try {
        offset = 0;

        do {
          const res = await getTeams(offset, limit, acc);

          res[1].forEach(team => {
            team.account = acc;
          });

          results = results.concat(res[1]);

          if (res[0] === true) {
            moreResults = true;
            offset += limit;
          } else {
            moreResults = false;
          }
        } while (moreResults === true);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        } else {
          throw new HttpError(`${error}`, 500);
        }
      }
    }),
  );

  // Sort teams alphabetically by name
  results.sort((a, b) => a.name.localeCompare(b.name));

  return results;
}

export async function isEventNoiseReductionEnabled(
  account?: string,
): Promise<boolean> {
  let response: Response;
  const baseUrl = 'https://api.pagerduty.com';
  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  try {
    response = await fetchWithRetries(`${baseUrl}/abilities`, options);
  } catch (error) {
    throw new Error(`Failed to read abilities: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to read abilities. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 401:
      throw new Error(
        `Failed to read abilities. Caller did not supply credentials or did not provide the correct credentials.`,
      );
    case 403:
      throw new Error(
        `Failed to read abilities. Caller is not authorized to view the requested resource.`,
      );
    case 429:
      throw new Error(`Failed to read abilities. Rate limit exceeded.`);
    default: // 200
      break;
  }

  let result: PagerDutyAbilitiesResponse;
  try {
    result = (await response.json()) as PagerDutyAbilitiesResponse;

    if (
      result.abilities.includes('preview_intelligent_alert_grouping') &&
      result.abilities.includes('time_based_alert_grouping')
    ) {
      return true;
    }

    return false;
  } catch (error) {
    throw new Error(`Failed to parse abilities information: ${error}`);
  }
}

export async function getOncallUsers(
  escalationPolicy: string,
  account?: string,
): Promise<PagerDutyUser[]> {
  let response: Response;
  const params = `time_zone=UTC&include[]=users&escalation_policy_ids[]=${escalationPolicy}`;
  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/oncalls`;

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve oncalls: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to list oncalls. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to list oncalls. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to list oncalls. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to list oncalls. Caller is not authorized to view the requested resource.',
        403,
      );
    case 429:
      throw new HttpError('Failed to list oncalls. Rate limit exceeded.', 429);
    default: // 200
      break;
  }

  let result: PagerDutyOnCallsResponse;
  let usersItem: PagerDutyUser[];
  try {
    result = (await response.json()) as PagerDutyOnCallsResponse;

    if (result.oncalls.length !== 0) {
      const oncallsSorted = [...result.oncalls].sort((a, b) => {
        return a.escalation_level - b.escalation_level;
      });

      const oncallsFiltered = oncallsSorted.filter(oncall => {
        return oncall.escalation_level === oncallsSorted[0].escalation_level;
      });

      usersItem = [...oncallsFiltered]
        .sort((a, b) => (a.user.name > b.user.name ? 1 : -1))
        .map(oncall => oncall.user);

      // remove duplicates from usersItem
      const uniqueUsers = new Map();
      usersItem.forEach(user => {
        uniqueUsers.set(user.id, user);
      });

      usersItem.length = 0;
      uniqueUsers.forEach(user => {
        usersItem.push(user);
      });

      return usersItem;
    }

    return [];
  } catch (error) {
    throw new HttpError(`Failed to parse oncall information: ${error}`, 500);
  }
}

export async function getServiceById(
  serviceId: string,
  account?: string,
  cache?: CacheService,
  logger?: LoggerService,
): Promise<PagerDutyService> {
  // Serve from cache first if this specific service is already cached.
  const cacheKey = serviceCacheKey(serviceId, account);
  const cached = await readCache<PagerDutyService>(cache, cacheKey);
  if (cached) {
    logger?.debug(`getServiceById: cache HIT for ${cacheKey}`);
    return cached;
  }
  if (cache) {
    logger?.debug(
      `getServiceById: cache MISS for ${cacheKey}, fetching from PagerDuty API`,
    );
  }

  let response: Response;
  const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies`;

  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${encodeURIComponent(serviceId)}?${params}`,
      options,
    );
  } catch (error) {
    throw new Error(`Failed to retrieve service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get service. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to get service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to get service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to get service. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServiceResponse;
  try {
    result = (await response.json()) as PagerDutyServiceResponse;

    await writeCache(cache, serviceCacheKey(serviceId, account), result.service);

    return result.service;
  } catch (error) {
    throw new HttpError(`Failed to parse service information: ${error}`, 500);
  }
}

// PagerDuty's `id[]` filter accepts at most 100 ids per request, and packing
// too many into the query string produces a URL long enough for the API
// gateway to reject with an HTML error page. Keep batches well under both
// limits.
const SERVICE_IDS_BATCH_SIZE = 50;

async function getServicesByIdsBatch(
  serviceIds: string[],
  account?: string,
): Promise<PagerDutyService[]> {
  let response: Response;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  const params = new URLSearchParams();
  serviceIds.forEach(id => params.append('id[]', id));

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get service. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to get service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to get service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to get service. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServicesResponse;
  try {
    result = (await response.json()) as PagerDutyServicesResponse;

    return result.services ?? [];
  } catch (error) {
    throw new HttpError(`Failed to parse service information: ${error}`, 500);
  }
}

export async function getSerivcesByIdsAndAccount(
  serviceIds: string[],
  account?: string,
): Promise<PagerDutyService[]> {
  if (serviceIds.length === 0) {
    return [];
  }

  const batches: string[][] = [];
  for (let i = 0; i < serviceIds.length; i += SERVICE_IDS_BATCH_SIZE) {
    batches.push(serviceIds.slice(i, i + SERVICE_IDS_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(batch => getServicesByIdsBatch(batch, account)),
  );

  return results.flat();
}

export async function getServiceByIntegrationKey(
  integrationKey: string,
  account?: string,
): Promise<PagerDutyService> {
  let response: Response;
  const params = `query=${integrationKey}&time_zone=UTC&include[]=integrations&include[]=escalation_policies`;

  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get service. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to get service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to get service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to get service. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyServicesResponse;
  try {
    result = (await response.json()) as PagerDutyServicesResponse;
  } catch (error) {
    throw new HttpError(`Failed to parse service information: ${error}`, 500);
  }

  if (result.services.length === 0) {
    throw new HttpError(
      `Failed to get service. The requested resource was not found.`,
      404,
    );
  }

  return result.services[0];
}

export async function getServicesByIds(
  ids: string[],
): Promise<PagerDutyService[]> {
  let services: PagerDutyService[] = [];
  await Promise.all(
    Object.entries(EndpointConfig).map(async ([account, _]) => {
      services = await getSerivcesByIdsAndAccount(ids, account);
    }),
  );
  return services;
}

export async function getAllServices(
  cache?: CacheService,
): Promise<PagerDutyService[]> {
  // Return the cached service list if we already have one; only hit the API
  // again when there are no cached services.
  const cached = await readCache<PagerDutyService[]>(
    cache,
    ALL_SERVICES_CACHE_KEY,
  );
  if (cached && cached.length > 0) {
    return cached;
  }

  const allServices: PagerDutyService[] = [];

  await Promise.all(
    Object.entries(EndpointConfig).map(async ([account, _]) => {
      let response: Response;
      const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies&include[]=teams&total=true`;

      const options: RequestInit = {
        method: 'GET',
        headers: await getDefaultHeaders(account),
      };

      const apiBaseUrl = getApiBaseUrl(account);
      const baseUrl = `${apiBaseUrl}/services`;

      let offset = 0;
      const limit = 50;
      let result: PagerDutyServicesAPIResponse;

      try {
        do {
          const paginatedUrl = `${baseUrl}?${params}&offset=${offset}&limit=${limit}`;

          response = await fetchWithRetries(paginatedUrl, options);

          if (response.status >= 500) {
            throw new HttpError(
              `Failed to get services. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
              response.status,
            );
          }

          switch (response.status) {
            case 400:
              throw new HttpError(
                'Failed to get services. Caller provided invalid arguments.',
                400,
              );
            case 401:
              throw new HttpError(
                'Failed to get services. Caller did not supply credentials or did not provide the correct credentials.',
                401,
              );
            case 403:
              throw new HttpError(
                'Failed to get services. Caller is not authorized to view the requested resource.',
                403,
              );
            default: // 200
              break;
          }

          result = (await response.json()) as PagerDutyServicesAPIResponse;

          result.services.forEach(service => {
            service.account = account;
          });

          allServices.push(...result.services);

          offset += limit;
        } while (offset < result.total!);
      } catch (error) {
        throw error;
      }
    }),
  );

  // Cache the full list, and index each service by id so single-service
  // lookups can be served from the cache too.
  await writeCache(cache, ALL_SERVICES_CACHE_KEY, allServices);
  await Promise.all(
    allServices.map(service =>
      writeCache(cache, serviceCacheKey(service.id, service.account), service),
    ),
  );

  return allServices;
}

export async function getServicesByPartialName(
  partialName: string,
): Promise<PagerDutyService[]> {
  const allServices: PagerDutyService[] = [];

  await Promise.all(
    Object.entries(EndpointConfig).map(async ([account, _]) => {
      let response: Response;
      const params = `query=${encodeURIComponent(partialName)}&time_zone=UTC&include[]=integrations&include[]=escalation_policies&include[]=teams&total=true`;

      const token = await getAuthToken(account);

      const options: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: token,
          Accept: 'application/vnd.pagerduty+json;version=2',
          'Content-Type': 'application/json',
        },
      };

      const apiBaseUrl = getApiBaseUrl(account);
      const baseUrl = `${apiBaseUrl}/services`;

      let offset = 0;
      const limit = 50;
      let result: PagerDutyServicesAPIResponse;

      try {
        do {
          const paginatedUrl = `${baseUrl}?${params}&offset=${offset}&limit=${limit}`;

          response = await fetchWithRetries(paginatedUrl, options);

          if (response.status >= 500) {
            throw new HttpError(
              `Failed to get services. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
              response.status,
            );
          }

          switch (response.status) {
            case 400:
              throw new HttpError(
                'Failed to get services. Caller provided invalid arguments.',
                400,
              );
            case 401:
              throw new HttpError(
                'Failed to get services. Caller did not supply credentials or did not provide the correct credentials.',
                401,
              );
            case 403:
              throw new HttpError(
                'Failed to get services. Caller is not authorized to view the requested resource.',
                403,
              );
            default: // 200
              break;
          }

          result = (await response.json()) as PagerDutyServicesAPIResponse;

          result.services.forEach(service => {
            service.account = account;
          });

          allServices.push(...result.services);

          offset += limit;
        } while (offset < result.total!);
      } catch (error) {
        throw error;
      }
    }),
  );

  return allServices;
}

export async function getFilteredServices(
  teamIds?: string[],
  query?: string,
  maxLimit?: number,
  account?: string,
): Promise<PagerDutyService[]> {
  const allServices: PagerDutyService[] = [];
  const limit = maxLimit || 100;

  const accountsToFetch = account ? [account] : Object.keys(EndpointConfig);

  await Promise.all(
    accountsToFetch.map(async (acc) => {
      let response: Response;
      let params = `time_zone=UTC&limit=${limit}`;

      if (teamIds && teamIds.length > 0) {
        const teamIdsParam = teamIds
          .map(id => `team_ids[]=${id}`)
          .join('&');
        params += `&${teamIdsParam}`;
      }

      if (query && query.trim() !== '') {
        params += `&query=${encodeURIComponent(query.trim())}`;
      }

      const token = await getAuthToken(acc);

      const options: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: token,
          Accept: 'application/vnd.pagerduty+json;version=2',
          'Content-Type': 'application/json',
        },
      };

      const apiBaseUrl = getApiBaseUrl(acc);
      const baseUrl = `${apiBaseUrl}/services`;

      try {
        // Fetch only ONE page with the specified limit
        response = await fetchWithRetries(`${baseUrl}?${params}`, options);

        if (response.status >= 500) {
          throw new HttpError(
            `Failed to get services. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
            response.status,
          );
        }

        switch (response.status) {
          case 400:
            throw new HttpError(
              'Failed to get services. Caller provided invalid arguments.',
              400,
            );
          case 401:
            throw new HttpError(
              'Failed to get services. Caller did not supply credentials or did not provide the correct credentials.',
              401,
            );
          case 403:
            throw new HttpError(
              'Failed to get services. Caller is not authorized to view the requested resource.',
              403,
            );
          default: // 200
            break;
        }

        const result = (await response.json()) as PagerDutyServicesAPIResponse;

        // set account for each service
        result.services.forEach(service => {
          service.account = acc;
        });

        allServices.push(...result.services);
      } catch (error) {
        throw error;
      }
    }),
  );

  return allServices;
}

export async function getChangeEvents(
  serviceId: string,
  account?: string,
): Promise<PagerDutyChangeEvent[]> {
  let response: Response;
  const params = `limit=5&time_zone=UTC&sort_by=timestamp`;
  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${encodeURIComponent(serviceId)}/change_events?${params}`,
      options,
    );
  } catch (error) {
    throw new Error(`Failed to retrieve change events for service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get change events for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get change events for service. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to get change events for service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to get change events for service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 404:
      throw new HttpError(
        'Failed to get change events for service. The requested resource was not found.',
        404,
      );
    default: // 200
      break;
  }

  let result: PagerDutyChangeEventsResponse;
  try {
    result = (await response.json()) as PagerDutyChangeEventsResponse;

    return result.change_events;
  } catch (error) {
    throw new HttpError(
      `Failed to parse change events information: ${error}`,
      500,
    );
  }
}

export async function getIncidents(
  serviceId: string,
  account?: string,
): Promise<PagerDutyIncident[]> {
  let response: Response;
  const params = `time_zone=UTC&sort_by=created_at&statuses[]=triggered&statuses[]=acknowledged&service_ids[]=${encodeURIComponent(serviceId)}`;

  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/incidents`;

  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve incidents for service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get incidents for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get incidents for service. Caller provided invalid arguments.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to get incidents for service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 402:
      throw new HttpError(
        'Failed to get incidents for service. Account does not have the abilities to perform the action. Please review the response for the required abilities.',
        402,
      );
    case 403:
      throw new HttpError(
        'Failed to get incidents for service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 429:
      throw new HttpError(
        'Failed to get incidents for service. Too many requests have been made, the rate limit has been reached.',
        429,
      );
    default: // 200
      break;
  }

  let result: PagerDutyIncidentsResponse;
  try {
    result = (await response.json()) as PagerDutyIncidentsResponse;

    return result.incidents;
  } catch (error) {
    throw new HttpError(`Failed to parse incidents information: ${error}`, 500);
  }
}

export async function getServiceStandards(
  serviceId: string,
  account?: string,
): Promise<PagerDutyServiceStandards> {
  let response: Response;

  const options: RequestInit = {
    method: 'GET',
    headers: await getDefaultHeaders(account),
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/standards/scores/technical_services/${encodeURIComponent(serviceId)}`;

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(
      `Failed to retrieve service standards for service: ${error}`,
    );
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get service standards for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 401:
      throw new HttpError(
        'Failed to get service standards for service. Caller did not supply credentials or did not provide the correct credentials.',
        401,
      );
    case 403:
      throw new HttpError(
        'Failed to get service standards for service. Caller is not authorized to view the requested resource.',
        403,
      );
    case 429:
      throw new HttpError(
        'Failed to get service standards for service. Too many requests have been made, the rate limit has been reached.',
        429,
      );
    default: // 200
      break;
  }

  try {
    const result = await response.json();
    return result;
  } catch (error) {
    throw new HttpError(
      `Failed to parse service standards information: ${error}`,
      500,
    );
  }
}

export async function getServiceMetrics(
  serviceId: string,
  account?: string,
): Promise<PagerDutyServiceMetrics[]> {
  let response: Response;

  const endDate = DateTime.now();
  const startDate = endDate.minus({ days: 30 });
  const body = JSON.stringify({
    filters: {
      created_at_start: startDate.toISO(),
      created_at_end: endDate.toISO(),
      service_ids: [serviceId],
    },
  });

  const options: RequestInit = {
    method: 'POST',
    headers: await getDefaultHeaders(account),
    body: body,
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/analytics/metrics/incidents/services`;

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service metrics for service: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get service metrics for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to get service metrics for service. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.',
        400,
      );
    case 429:
      throw new HttpError(
        'Failed to get service metrics for service. Too many requests have been made, the rate limit has been reached.',
        429,
      );
    default: // 200
      break;
  }

  try {
    const result = await response.json();

    return result.data;
  } catch (error) {
    throw new HttpError(
      `Failed to parse service metrics information: ${error}`,
      500,
    );
  }
}

export type CreateServiceIntegrationProps = {
  serviceId: string;
  vendorId: string;
  account?: string;
};

export async function createServiceIntegration({
  serviceId,
  vendorId,
  account,
}: CreateServiceIntegrationProps): Promise<string> {
  let response: Response;

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify({
      integration: {
        name: 'Backstage',
        service: {
          id: serviceId,
          type: 'service_reference',
        },
        vendor: {
          id: vendorId,
          type: 'vendor_reference',
        },
      },
    }),
    headers: await getDefaultHeaders(account),
  };

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${encodeURIComponent(serviceId)}/integrations`,
      options,
    );
  } catch (error) {
    throw new Error(`Failed to create service integration: ${error}`);
  }

  if (response.status >= 500) {
    throw new Error(
      `Failed to create service integration. PagerDuty API returned a server error. Retrying with the same arguments will not work.`,
    );
  }

  switch (response.status) {
    case 400:
      throw new Error(
        `Failed to create service integration. Caller provided invalid arguments.`,
      );
    case 401:
      throw new Error(
        `Failed to create service integration. Caller did not supply credentials or did not provide the correct credentials.`,
      );
    case 403:
      throw new Error(
        `Failed to create service integration. Caller is not authorized to view the requested resource.`,
      );
    case 429:
      throw new Error(
        `Failed to create service integration. Rate limit exceeded.`,
      );
    default: // 201
      break;
  }

  let result: PagerDutyIntegrationResponse;
  try {
    result = (await response.json()) as PagerDutyIntegrationResponse;

    return result.integration.integration_key ?? '';
  } catch (error) {
    throw new Error(`Failed to parse service information: ${error}`);
  }
}

function getAllowedApiOrigins(): Set<string> {
  const origins = new Set<string>();

  const addOrigin = (apiBaseUrl?: string) => {
    if (!apiBaseUrl) {
      return;
    }
    try {
      origins.add(new URL(apiBaseUrl).origin);
    } catch {
      // ignore malformed configured URLs
    }
  };

  Object.values(EndpointConfig).forEach(cfg => addOrigin(cfg.apiBaseUrl));
  addOrigin(fallbackEndpointConfig?.apiBaseUrl);

  // Always allow the public PagerDuty API host (default for every config path,
  // and used directly by isEventNoiseReductionEnabled).
  origins.add('https://api.pagerduty.com');

  return origins;
}

export async function fetchWithRetries(
  url: string,
  options: RequestInit,
): Promise<Response> {
  // Guard against SSRF: only allow requests to configured PagerDuty API origins.
  // The host is server-controlled, but path segments may be user-provided, so we
  // validate the resolved origin against an allow-list before fetching.
  let requestOrigin: string;
  try {
    requestOrigin = new URL(url).origin;
  } catch {
    throw new Error('Refusing to fetch invalid URL.');
  }

  if (!getAllowedApiOrigins().has(requestOrigin)) {
    throw new Error(
      `Refusing to fetch URL with disallowed origin: ${requestOrigin}`,
    );
  }

  let response: Response;
  let error: Error = new Error();

  // set retry parameters
  const maxRetries = 5;
  const delay = 1000;
  let factor = 2;

  for (let i = 0; i < maxRetries; i++) {
    try {
      response = await fetch(url, options);
      return response;
    } catch (e) {
      error = e as Error;
    }

    const timeout = delay * factor;
    await new Promise(resolve => setTimeout(resolve, timeout));
    factor *= 2;
  }

  throw new Error(
    `Failed to fetch data after ${maxRetries} retries. Last error: ${error}`,
  );
}

export type CreateCustomFieldProps = {
  request: PagerDutyCustomFieldCreateRequest;
  account?: string;
};

export async function createCustomField({
  request,
  account,
}: CreateCustomFieldProps): Promise<PagerDutyCustomFieldResponse> {
  let response: Response;

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services/custom_fields`;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify(request),
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to create custom field: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to create custom field. PagerDuty API returned a server error.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400: {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        `Failed to create custom field. Invalid arguments: ${JSON.stringify(errorData)}`,
        400,
      );
    }
    case 401:
      throw new HttpError(
        `Failed to create custom field. Invalid credentials provided.`,
        401,
      );
    case 403:
      throw new HttpError(
        `Failed to create custom field. Not authorized to perform this action.`,
        403,
      );
    case 409: {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        `Custom field with this name already exists: ${JSON.stringify(errorData)}`,
        409,
      );
    }
    case 429:
      throw new HttpError(`Rate limit exceeded.`, 429);
    default: // 201
      break;
  }

  try {
    const result = (await response.json()) as PagerDutyCustomFieldResponse;
    return result;
  } catch (error) {
    throw new Error(`Failed to parse custom field response: ${error}`);
  }
}

export type UpdateCustomFieldProps = {
  fieldId: string;
  request: PagerDutyCustomFieldUpdateRequest;
  account?: string;
};

export async function updateCustomField({
  fieldId,
  request,
  account,
}: UpdateCustomFieldProps): Promise<PagerDutyCustomFieldResponse> {
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services/custom_fields/${encodeURIComponent(fieldId)}`;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'PUT',
    body: JSON.stringify(request),
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  let response: Response;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to update custom field: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to update custom field. PagerDuty API returned a server error.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400: {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        `Failed to update custom field. Invalid arguments: ${JSON.stringify(errorData)}`,
        400,
      );
    }
    case 401:
      throw new HttpError(
        `Failed to update custom field. Invalid credentials provided.`,
        401,
      );
    case 403:
      throw new HttpError(
        `Failed to update custom field. Not authorized to perform this action.`,
        403,
      );
    case 404:
      throw new HttpError(
        `Failed to update custom field. Custom field not found.`,
        404,
      );
    case 409: {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        `Custom field with this name already exists: ${JSON.stringify(errorData)}`,
        409,
      );
    }
    case 429:
      throw new HttpError(`Rate limit exceeded.`, 429);
    default: // 200
      break;
  }

  try {
    const result = (await response.json()) as PagerDutyCustomFieldResponse;
    return result;
  } catch (error) {
    throw new Error(`Failed to parse custom field response: ${error}`);
  }
}

export type GetCustomFieldsProps = {
  account?: string;
};

export async function getCustomFields({
  account,
}: GetCustomFieldsProps = {}): Promise<PagerDutyCustomFieldsResponse> {
  let response: Response;

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services/custom_fields`;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
    },
  };

  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to get custom fields: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to get custom fields. PagerDuty API returned a server error.`,
      response.status,
    );
  }

  switch (response.status) {
    case 401:
      throw new HttpError(
        `Failed to get custom fields. Invalid credentials provided.`,
        401,
      );
    case 403:
      throw new HttpError(
        `Failed to get custom fields. Not authorized to perform this action.`,
        403,
      );
    case 429:
      throw new HttpError(`Rate limit exceeded.`, 429);
    default: // 200
      break;
  }

  try {
    const result = (await response.json()) as PagerDutyCustomFieldsResponse;
    return result;
  } catch (error) {
    throw new Error(`Failed to parse custom fields response: ${error}`);
  }
}

export type DeleteCustomFieldProps = {
  fieldId: string;
  account?: string;
};

export async function deleteCustomField({
  fieldId,
  account,
}: DeleteCustomFieldProps): Promise<void> {
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services/custom_fields/${encodeURIComponent(fieldId)}`;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'DELETE',
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
    },
  };

  let response: Response;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to delete custom field: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to delete custom field. PagerDuty API returned a server error.`,
      response.status,
    );
  }

  switch (response.status) {
    case 401:
      throw new HttpError(
        `Failed to delete custom field. Invalid credentials provided.`,
        401,
      );
    case 403:
      throw new HttpError(
        `Failed to delete custom field. Caller is not authorized to delete this custom field.`,
        403,
      );
    case 404:
      throw new HttpError(`Custom field not found.`, 404);
    case 429:
      throw new HttpError(`Rate limit exceeded.`, 429);
    default: // 204
      break;
  }
}

export type SetServiceCustomFieldValuesProps = {
  serviceId: string;
  request: PagerDutyServiceCustomFieldValuesRequest;
  account?: string;
};

export async function setServiceCustomFieldValues({
  serviceId,
  request,
  account,
}: SetServiceCustomFieldValuesProps): Promise<PagerDutyServiceCustomFieldValuesResponse> {
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services/${encodeURIComponent(serviceId)}/custom_fields/values`;
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'PUT',
    body: JSON.stringify(request),
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  let response: Response;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to set service custom field values: ${error}`);
  }

  if (response.status >= 500) {
    throw new HttpError(
      `Failed to set service custom field values. PagerDuty API returned a server error.`,
      response.status,
    );
  }

  switch (response.status) {
    case 400: {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        `Failed to set service custom field values. Invalid arguments: ${JSON.stringify(errorData)}`,
        400,
      );
    }
    case 401:
      throw new HttpError(
        `Failed to set service custom field values. Invalid credentials provided.`,
        401,
      );
    case 403:
      throw new HttpError(
        `Failed to set service custom field values. Not authorized to perform this action.`,
        403,
      );
    case 404:
      throw new HttpError(
        `Failed to set service custom field values. Service or custom field not found.`,
        404,
      );
    case 429:
      throw new HttpError(`Rate limit exceeded.`, 429);
    default: // 200
      break;
  }

  try {
    const result =
      (await response.json()) as PagerDutyServiceCustomFieldValuesResponse;
    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse set service custom field values response: ${error}`,
    );
  }
}
