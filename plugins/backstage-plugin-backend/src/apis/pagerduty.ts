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
} from '@pagerduty/backstage-plugin-common';

import { DateTime } from 'luxon';
import {
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

export function setFallbackEndpointConfig(account: PagerDutyAccountConfig) {
  fallbackEndpointConfig = {
    eventsBaseUrl: account.eventsBaseUrl ?? 'https://events.pagerduty.com/v2',
    apiBaseUrl: account.apiBaseUrl ?? 'https://api.pagerduty.com',
  };
}

export function insertEndpointConfig(account: PagerDutyAccountConfig) {
  EndpointConfig[account.id] = {
    eventsBaseUrl: account.eventsBaseUrl ?? 'https://events.pagerduty.com/v2',
    apiBaseUrl: account.apiBaseUrl ?? 'https://api.pagerduty.com',
  };
}

export function loadPagerDutyEndpointsFromConfig(
  config: RootConfigService,
  logger: LoggerService,
) {
  if (config.getOptional('pagerDuty.accounts')) {
    logger.debug(
      `New accounts configuration detected. Loading PagerDuty endpoints from config.`,
    );
    isLegacyConfig = false;

    const accounts =
      config.getOptional<PagerDutyAccountConfig[]>('pagerDuty.accounts');

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
    } else {
      logger.debug(
        `Multiple account configuration detected. Loading PagerDuty endpoints from config.`,
      );
      accounts?.forEach(account => {
        if (account.isDefault) {
          setFallbackEndpointConfig(account);
        }

        insertEndpointConfig(account);
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

// Supporting router
export async function addServiceRelationsToService(
  serviceRelations: PagerDutyServiceDependency[],
  account?: string,
): Promise<PagerDutyServiceDependency[]> {
  let response: Response;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/technical_services/${serviceId}`;

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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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

export async function isEventNoiseReductionEnabled(
  account?: string,
): Promise<boolean> {
  let response: Response;
  const baseUrl = 'https://api.pagerduty.com';
  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
): Promise<PagerDutyService> {
  let response: Response;
  const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
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

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${serviceId}?${params}`,
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

    return result.service;
  } catch (error) {
    throw new HttpError(`Failed to parse service information: ${error}`, 500);
  }
}

export async function getSerivcesByIdsAndAccount(
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

  try {
    response = await fetchWithRetries(
      `${baseUrl}?id[]=${serviceIds.join('&id[]=')}`,
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

  let result: PagerDutyServicesResponse;
  try {
    result = (await response.json()) as PagerDutyServicesResponse;

    return result.services ?? [];
  } catch (error) {
    throw new HttpError(`Failed to parse service information: ${error}`, 500);
  }
}

export async function getServiceByIntegrationKey(
  integrationKey: string,
  account?: string,
): Promise<PagerDutyService> {
  let response: Response;
  const params = `query=${integrationKey}&time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
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

export async function getAllServices(): Promise<PagerDutyService[]> {
  const allServices: PagerDutyService[] = [];

  await Promise.all(
    Object.entries(EndpointConfig).map(async ([account, _]) => {
      let response: Response;
      const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies&include[]=teams&total=true`;

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

          // set account
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

          // set account
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

export async function getChangeEvents(
  serviceId: string,
  account?: string,
): Promise<PagerDutyChangeEvent[]> {
  let response: Response;
  const params = `limit=5&time_zone=UTC&sort_by=timestamp`;
  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${serviceId}/change_events?${params}`,
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
  const params = `time_zone=UTC&sort_by=created_at&statuses[]=triggered&statuses[]=acknowledged&service_ids[]=${serviceId}`;

  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/standards/scores/technical_services/${serviceId}`;

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
    headers: {
      Authorization: await getAuthToken(account),
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
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
  const token = await getAuthToken(account);

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
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  try {
    response = await fetchWithRetries(
      `${baseUrl}/${serviceId}/integrations`,
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

export async function fetchWithRetries(
  url: string,
  options: RequestInit,
): Promise<Response> {
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
