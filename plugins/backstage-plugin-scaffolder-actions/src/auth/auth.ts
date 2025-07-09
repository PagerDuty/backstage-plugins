import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import {
  HttpError,
  PagerDutyAccountConfig,
} from '@pagerduty/backstage-plugin-common';
import { Config } from '@backstage/config';

export type LoadAuthConfigProps = {
  config: RootConfigService | undefined;
  legacyConfig: Config;
  logger: LoggerService;
};

type JsonValue = boolean | number | string | null | JsonArray | JsonObject;

interface JsonObject {
  [x: string]: JsonValue;
}

type JsonArray = JsonValue[];

type AccountTokenInfo = {
  authToken: string;
  authTokenExpiryDate: number;
};

type Auth = {
  accountTokens: Record<string, AccountTokenInfo>;
  defaultAccount?: string;
  config?: RootConfigService;
  legacyConfig?: Config;
  logger?: LoggerService;
};

let authPersistence: Auth;
let isLegacyConfig = false;
let _config: RootConfigService | undefined;
let _legacyConfig: Config;
let _logger: LoggerService;

async function checkForOAuthToken(tokenId: string): Promise<boolean> {
  if (
    authPersistence.accountTokens[tokenId]?.authToken !== '' &&
    authPersistence.accountTokens[tokenId]?.authToken.includes('Bearer')
  ) {
    if (
      authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now()
    ) {
      return true;
    }
    _logger.info('OAuth token expired, renewing');
    await loadAuthConfig({
      config: _config,
      legacyConfig: _legacyConfig,
      logger: _logger,
    });
    return (
      authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now()
    );
  }
  return false;
}

export async function getAuthToken(accountId?: string): Promise<string> {
  // if authPersistence is not initialized, load the auth config
  if (!authPersistence?.accountTokens) {
    _logger.debug('Auth config not loaded. Loading auth config...');
    await loadAuthConfig({
      config: _config,
      legacyConfig: _legacyConfig,
      logger: _logger,
    });
  }

  if (isLegacyConfig) {
    _logger.debug('Using legacy config for auth token retrieval.');
    if (
      authPersistence.accountTokens.default.authToken !== '' &&
      ((await checkForOAuthToken('default')) ||
        authPersistence.accountTokens.default.authToken.includes('Token'))
    ) {
      return authPersistence.accountTokens.default.authToken;
    }
  } else {
    _logger.debug('Using new config for auth token retrieval.');
    // check if accountId is provided
    if (accountId && accountId !== '') {
      if (
        authPersistence.accountTokens[accountId]?.authToken !== '' &&
        ((await checkForOAuthToken(accountId)) ||
          authPersistence.accountTokens[accountId]?.authToken.includes('Token'))
      ) {
        return authPersistence.accountTokens[accountId].authToken;
      }
    } else {
      // return default account token if accountId is not provided
      const defaultFallback = authPersistence.defaultAccount ?? '';
      _logger.debug('No account ID provided. Using default account token.');

      if (
        authPersistence.accountTokens[defaultFallback]?.authToken !== '' &&
        ((await checkForOAuthToken(defaultFallback)) ||
          authPersistence.accountTokens[defaultFallback]?.authToken.includes(
            'Token',
          ))
      ) {
        return authPersistence.accountTokens[defaultFallback].authToken;
      }
    }
  }

  return '';
}

export async function loadAuthConfig({
  config,
  legacyConfig,
  logger,
}: LoadAuthConfigProps) {
  try {
    const defaultAccountId = 'default';

    // set config and logger
    _config = config;
    _legacyConfig = legacyConfig;
    _logger = logger;

    // initiliaze the authPersistence in-memory object
    authPersistence = {
      accountTokens: {},
      config: _config,
      legacyConfig: _legacyConfig,
      logger: _logger,
    };

    // check if new accounts config is present
    if (!readOptionalObject('pagerDuty.accounts')) {
      isLegacyConfig = true;
      logger.warn(
        'No PagerDuty accounts configuration found in config file. Reverting to legacy configuration.',
      );

      if (!readOptionalString('pagerDuty.apiToken')) {
        logger.warn(
          'No PagerDuty API token found in config file. Trying OAuth token instead...',
        );

        if (!readOptionalObject('pagerDuty.oauth')) {
          logger.error(
            'No PagerDuty OAuth configuration found in config file.',
          );
        } else if (
          !readOptionalString('pagerDuty.oauth.clientId') ||
          !readOptionalString('pagerDuty.oauth.clientSecret') ||
          !readOptionalString('pagerDuty.oauth.subDomain')
        ) {
          logger.error(
            "Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.",
          );
        } else {
          const tokenInfo: AccountTokenInfo = await getOAuthToken(
            readString('pagerDuty.oauth.clientId'),
            readString('pagerDuty.oauth.clientSecret'),
            readString('pagerDuty.oauth.subDomain'),
            readOptionalString('pagerDuty.oauth.region') ?? 'us',
          );

          authPersistence.accountTokens[defaultAccountId] = tokenInfo;

          logger.debug('PagerDuty OAuth configuration loaded successfully.');
        }
      } else {
        authPersistence.accountTokens[defaultAccountId] = {
          authToken: `Token token=${readOptionalString('pagerDuty.apiToken')}`,
          authTokenExpiryDate: Date.now() + 3600000 * 24 * 365 * 2, // 2 years
        };

        logger.debug('PagerDuty API token loaded successfully.');
      }
    } else {
      // new accounts config is present
      logger.debug(
        'New PagerDuty accounts configuration found in config file.',
      );
      isLegacyConfig = false;

      const accounts: PagerDutyAccountConfig[] = JSON.parse(
        JSON.stringify(readOptionalObject('pagerDuty.accounts')),
      );

      if (accounts && accounts?.length === 1) {
        logger.debug(
          'Only one account found in config file. Setting it as default.',
        );
        authPersistence.defaultAccount = accounts[0].id;
      }

      await Promise.all(
        accounts?.map(async account => {
          const maskedAccountId = maskString(account.id);

          if (account.isDefault && !authPersistence.defaultAccount) {
            logger.debug(
              `Default account found in config file. Setting it as default.`,
            );
            authPersistence.defaultAccount = account.id;
          }

          if (!account.apiToken) {
            logger.warn(
              'No PagerDuty API token found in config file. Trying OAuth token instead...',
            );

            if (!account.oauth) {
              logger.error(
                'No PagerDuty OAuth configuration found in config file.',
              );
            } else if (
              !account.oauth.clientId ||
              !account.oauth.clientSecret ||
              !account.oauth.subDomain
            ) {
              logger.error(
                "Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.",
              );
            } else {
              const tokenInfo: AccountTokenInfo = await getOAuthToken(
                account.oauth.clientId,
                account.oauth.clientSecret,
                account.oauth.subDomain,
                account.oauth.region ?? 'us',
              );

              authPersistence.accountTokens[account.id] = tokenInfo;

              logger.debug(
                `PagerDuty OAuth configuration loaded successfully for account ${maskedAccountId}.`,
              );
            }
          } else {
            authPersistence.accountTokens[account.id] = {
              authToken: `Token token=${account.apiToken}`,
              authTokenExpiryDate: Date.now() + 3600000 * 24 * 365 * 2, // 2 years
            };

            logger.debug(
              `PagerDuty API token loaded successfully for account ${maskedAccountId}.`,
            );
          }
        }),
      );

      if (!authPersistence.defaultAccount) {
        logger.error(
          'No default account found in config file. One account must be marked as default.',
        );
      }
    }
  } catch (error) {
    logger.error(
      `Unable to retrieve valid PagerDuty AUTH configuration from config file: ${error}`,
    );
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

async function getOAuthToken(
  clientId: string,
  clientSecret: string,
  subDomain: string,
  region: string,
): Promise<AccountTokenInfo> {
  // check if required parameters are provided
  if (!clientId || !clientSecret || !subDomain) {
    throw new Error('Missing required PagerDuty OAuth parameters.');
  }

  // define the scopes required for the OAuth token
  const scopes = `
        abilities.read 
        analytics.read
        change_events.read 
        escalation_policies.read 
        incidents.read 
        oncalls.read 
        schedules.read 
        services.read 
        services.write 
        standards.read
        teams.read 
        users.read 
        vendors.read
    `;

  // encode the parameters for the request
  const urlencoded = new URLSearchParams();
  urlencoded.append('grant_type', 'client_credentials');
  urlencoded.append('client_id', clientId);
  urlencoded.append('client_secret', clientSecret);
  urlencoded.append('scope', `as_account-${region}.${subDomain} ${scopes}`);

  let response: Response;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: urlencoded,
  };
  const baseUrl = 'https://identity.pagerduty.com/oauth/token';

  try {
    response = await fetch(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve oauth token: ${error}`);
  }

  switch (response.status) {
    case 400:
      throw new HttpError(
        'Failed to retrieve valid token. Bad Request - Invalid arguments provided.',
        400,
      );
    case 401:
      throw new HttpError(
        'Failed to retrieve valid token. Forbidden - Invalid credentials provided.',
        401,
      );
    default: // 200
      break;
  }

  const authResponse = await response.json();

  const result: AccountTokenInfo = {
    authToken: `Bearer ${authResponse.access_token}`,
    authTokenExpiryDate: Date.now() + authResponse.expires_in * 1000,
  };

  return result;
}

function maskString(str: string): string {
  return str[0] + '*'.repeat(str.length - 2) + str.slice(-1);
}
