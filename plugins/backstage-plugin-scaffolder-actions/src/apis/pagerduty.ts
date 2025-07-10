import fetch from 'node-fetch';
import type { RequestInit, Response } from 'node-fetch';

import { getAuthToken } from '../auth/auth';
import { CreateServiceResponse } from '../types';

import {
  PagerDutyServiceResponse,
  PagerDutyIntegrationResponse,
  PagerDutyAbilitiesResponse,
  PagerDutyAccountConfig,
  PagerDutyEscalationPolicy,
  HttpError,
  PagerDutyEscalationPoliciesResponse,
} from 'common';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

type JsonValue = boolean | number | string | null | JsonArray | JsonObject;

interface JsonObject {
  [x: string]: JsonValue;
}

type JsonArray = JsonValue[];

export type LoadEndpointConfigProps = {
  config: RootConfigService | undefined;
  legacyConfig: Config;
  logger: LoggerService;
};

export type PagerDutyEndpointConfig = {
  eventsBaseUrl: string;
  apiBaseUrl: string;
};

const EndpointConfig: Record<string, PagerDutyEndpointConfig> = {};
let fallbackEndpointConfig: PagerDutyEndpointConfig;
let isLegacyConfig = false;

let _config: RootConfigService | undefined;
let _legacyConfig: Config;
let _logger: LoggerService;

export function setFallbackEndpointConfig(account: PagerDutyAccountConfig) {
  fallbackEndpointConfig = {
    eventsBaseUrl:
      account.eventsBaseUrl !== undefined
        ? account.eventsBaseUrl
        : 'https://events.pagerduty.com/v2',
    apiBaseUrl:
      account.apiBaseUrl !== undefined
        ? account.apiBaseUrl
        : 'https://api.pagerduty.com',
  };
}

export function insertEndpointConfig(account: PagerDutyAccountConfig) {
  EndpointConfig[account.id] = {
    eventsBaseUrl:
      account.eventsBaseUrl !== undefined
        ? account.eventsBaseUrl
        : 'https://events.pagerduty.com/v2',
    apiBaseUrl:
      account.apiBaseUrl !== undefined
        ? account.apiBaseUrl
        : 'https://api.pagerduty.com',
  };
}

export function loadPagerDutyEndpointsFromConfig({
  config,
  legacyConfig,
  logger,
}: LoadEndpointConfigProps) {
  // set config and logger
  _config = config;
  _legacyConfig = legacyConfig;
  _logger = logger;

  if (readOptionalObject('pagerDuty.accounts')) {
    _logger.debug(
      `New accounts configuration detected. Loading PagerDuty endpoints from config.`,
    );
    isLegacyConfig = false;

    const accounts: PagerDutyAccountConfig[] = JSON.parse(
      JSON.stringify(readOptionalObject('pagerDuty.accounts')),
    );

    if (accounts?.length === 1) {
      _logger.debug(
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
      _logger.debug(
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
    _logger.debug(`Loading legacy PagerDuty endpoints from config.`);
    isLegacyConfig = true;

    EndpointConfig.default = {
      eventsBaseUrl:
        readOptionalString('pagerDuty.eventsBaseUrl') !== undefined
          ? readString('pagerDuty.eventsBaseUrl')
          : 'https://events.pagerduty.com/v2',
      apiBaseUrl:
        readOptionalString('pagerDuty.apiBaseUrl') !== undefined
          ? readString('pagerDuty.apiBaseUrl')
          : 'https://api.pagerduty.com',
    };
  }
}

export function getApiBaseUrl(account?: string): string {
  if (isLegacyConfig === true) {
    return EndpointConfig.default.apiBaseUrl;
  }

  if (account) {
    return EndpointConfig[account].apiBaseUrl;
  }

  return fallbackEndpointConfig.apiBaseUrl;
}

export type CreateServiceProps = {
  name: string;
  description: string;
  escalationPolicyId: string;
  account?: string;
  alertGrouping?: string;
};

// Supporting custom actions
export async function createService({
  name,
  description,
  escalationPolicyId,
  account,
  alertGrouping,
}: CreateServiceProps): Promise<CreateServiceResponse> {
  let alertGroupingParameters = 'null';
  let response: Response;

  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;

  // Set default body
  let body = JSON.stringify({
    service: {
      type: 'service',
      name: name,
      description: description,
      alert_creation: 'create_alerts_and_incidents',
      auto_pause_notifications_parameters: {
        enabled: true,
        timeout: 300,
      },
      escalation_policy: {
        id: escalationPolicyId,
        type: 'escalation_policy_reference',
      },
    },
  });

  // Override body if alert grouping is enabled and passed as parameter
  if (
    (await isEventNoiseReductionEnabled(account)) &&
    alertGrouping !== undefined
  ) {
    alertGroupingParameters = alertGrouping;

    switch (alertGroupingParameters) {
      case 'intelligent':
        body = JSON.stringify({
          service: {
            type: 'service',
            name: name,
            description: description,
            escalation_policy: {
              id: escalationPolicyId,
              type: 'escalation_policy_reference',
            },
            alert_creation: 'create_alerts_and_incidents',
            alert_grouping_parameters: {
              type: alertGroupingParameters,
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300,
            },
          },
        });
        break;
      case 'time':
        body = JSON.stringify({
          service: {
            type: 'service',
            name: name,
            description: description,
            escalation_policy: {
              id: escalationPolicyId,
              type: 'escalation_policy_reference',
            },
            alert_creation: 'create_alerts_and_incidents',
            alert_grouping_parameters: {
              type: alertGroupingParameters,
              config: {
                timeout: 0,
              },
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300,
            },
          },
        });
        break;
      case 'content_based':
        body = JSON.stringify({
          service: {
            type: 'service',
            name: name,
            description: description,
            escalation_policy: {
              id: escalationPolicyId,
              type: 'escalation_policy_reference',
            },
            alert_creation: 'create_alerts_and_incidents',
            alert_grouping_parameters: {
              type: alertGroupingParameters,
              config: {
                aggregate: 'all',
                time_window: 0,
                fields: ['source', 'summary'],
              },
            },
            auto_pause_notifications_parameters: {
              enabled: true,
              timeout: 300,
            },
          },
        });
        break;
      default:
        break;
    }
  }

  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'POST',
    body: body,
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  try {
    response = await fetch(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to create service: ${error}`);
  }

  switch (response.status) {
    case 400:
      throw new Error(
        `Failed to create service. Caller provided invalid arguments.`,
      );
    case 401:
      throw new Error(
        `Failed to create service. Caller did not supply credentials or did not provide the correct credentials.`,
      );
    case 402:
      throw new Error(
        `Failed to create service. Account does not have the abilities to perform the action.`,
      );
    case 403:
      throw new Error(
        `Failed to create service. Caller is not authorized to view the requested resource.`,
      );
    default: // 201
      break;
  }

  let result: PagerDutyServiceResponse;
  try {
    result = (await response.json()) as PagerDutyServiceResponse;

    const createServiceResult: CreateServiceResponse = {
      url: result.service.html_url,
      id: result.service.id,
      alertGrouping: alertGroupingParameters,
    };

    return createServiceResult;
  } catch (error) {
    throw new Error(`Failed to parse service information: ${error}`);
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
    response = await fetch(`${baseUrl}/${serviceId}/integrations`, options);
  } catch (error) {
    throw new Error(`Failed to create service integration: ${error}`);
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

export async function isEventNoiseReductionEnabled(
  account?: string,
): Promise<boolean> {
  let response: Response;
  const baseUrl = getApiBaseUrl(account);
  const token = await getAuthToken(account);

  const options: RequestInit = {
    method: 'GET',
    headers: {
      Authorization: token,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  };

  try {
    response = await fetch(`${baseUrl}/abilities`, options);
  } catch (error) {
    throw new Error(`Failed to read abilities: ${error}`);
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

function readOptionalString(key: string): string | undefined {
  if (!_config) {
    return _legacyConfig.getOptionalString(key);
  }

  return _config.getOptionalString(key);
}

function readOptionalObject(key: string): JsonValue | undefined {
  if (!_config) {
    return _legacyConfig.getOptional(key);
  }

  return _config.getOptional(key);
}

function readString(key: string): string {
  if (!_config) {
    return _legacyConfig.getString(key);
  }

  return _config.getString(key);
}

export async function getAccountByEscalationPolicyId(
  escalationPolicyId: string,
): Promise<string> {
  const escalationPoliciesList: PagerDutyEscalationPolicy[] =
    await getAllEscalationPolicies();

  // find escalation policy by id and return account
  const escalationPolicy = escalationPoliciesList.find(
    policy => policy.id === escalationPolicyId,
  );

  return escalationPolicy?.account ?? '';
}

async function getEscalationPolicies(
  offset: number,
  limit: number,
  account?: string,
): Promise<[Boolean, PagerDutyEscalationPolicy[]]> {
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
    response = await fetch(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve escalation policies: ${error}`);
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
