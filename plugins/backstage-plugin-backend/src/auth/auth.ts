import { LoggerService, RootConfigService } from "@backstage/backend-plugin-api";
import { HttpError, PagerDutyAccountConfig } from "@pagerduty/backstage-plugin-common";

type AccountTokenInfo = {
    authToken: string;
    authTokenExpiryDate: number;
}

type Auth = {
    config: RootConfigService;
    logger: LoggerService;
    accountTokens: Record<string, AccountTokenInfo>;
    defaultAccount?: string;
}

let authPersistence: Auth;
let isLegacyConfig = false;

async function checkForOAuthToken(tokenId: string): Promise<boolean> {
    if (authPersistence.accountTokens[tokenId]?.authToken !== '' &&
        authPersistence.accountTokens[tokenId]?.authToken.includes('Bearer')) {
            if (authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now()) {
                return true
            }
            authPersistence.logger.info('OAuth token expired, renewing');
            await loadAuthConfig(authPersistence.config, authPersistence.logger);
            return authPersistence.accountTokens[tokenId].authTokenExpiryDate > Date.now()
        }
    return false
}

export async function getAuthToken(accountId? : string): Promise<string> {
    // if authPersistence is not initialized, load the auth config
    if (!authPersistence?.accountTokens) {
        await loadAuthConfig(authPersistence.config, authPersistence.logger);
    }

    if (isLegacyConfig && authPersistence.accountTokens.default.authToken !== '' 
        && (await checkForOAuthToken('default') || authPersistence.accountTokens.default.authToken.includes('Token'))) {
            return authPersistence.accountTokens.default.authToken;
    }
    const key = accountId && accountId !== '' ? accountId : authPersistence.defaultAccount ?? '';

    if (authPersistence.accountTokens[key]?.authToken !== ''
        && (await checkForOAuthToken(key) || authPersistence.accountTokens[key]?.authToken.includes('Token'))) {
            return authPersistence.accountTokens[key].authToken;
    }

    return '';
}

export async function loadAuthConfig(config : RootConfigService, logger: LoggerService) {
    try {
        const defaultAccountId = 'default';

        // initiliaze the authPersistence in-memory object
        authPersistence = {
            config,
            logger,
            accountTokens: {}
        };

        // check if new accounts config is present
        if(!config.getOptional('pagerDuty.accounts')){
            isLegacyConfig = true;
            logger.warn('No PagerDuty accounts configuration found in config file. Reverting to legacy configuration.');

            if (!config.getOptionalString('pagerDuty.apiToken')) {
                logger.warn('No PagerDuty API token found in config file. Trying OAuth token instead...');

                if (!config.getOptional('pagerDuty.oauth')) {

                    logger.error('No PagerDuty OAuth configuration found in config file.');

                } else if (!config.getOptionalString('pagerDuty.oauth.clientId') || !config.getOptionalString('pagerDuty.oauth.clientSecret') || !config.getOptionalString('pagerDuty.oauth.subDomain')) {

                    logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");

                } else {
                    const tokenInfo : AccountTokenInfo = await getOAuthToken(
                        config.getString('pagerDuty.oauth.clientId'),
                        config.getString('pagerDuty.oauth.clientSecret'),
                        config.getString('pagerDuty.oauth.subDomain'),
                        config.getOptionalString('pagerDuty.oauth.region') ?? 'us');

                    authPersistence.accountTokens[defaultAccountId] = tokenInfo;

                    logger.info('PagerDuty OAuth configuration loaded successfully.');
                }
            } else {
                authPersistence.accountTokens[defaultAccountId] = {
                    authToken: `Token token=${config.getString('pagerDuty.apiToken')}`,
                    authTokenExpiryDate: Date.now() + 3600000 * 24 * 365 * 2 // 2 years
                };

                logger.info('PagerDuty API token loaded successfully.');
            }
        } 
        else { // new accounts config is present
            logger.info('New PagerDuty accounts configuration found in config file.');
            isLegacyConfig = false;
            const accounts = config.getOptional<PagerDutyAccountConfig[]>('pagerDuty.accounts') || [];


            if(accounts && accounts?.length === 1){
                logger.info('Only one account found in config file. Setting it as default.');
                authPersistence.defaultAccount = accounts[0].id;
            }

            await Promise.all(accounts.map(async account => {
                const maskedAccountId = maskString(account.id);

                if(account.isDefault && !authPersistence.defaultAccount){
                    logger.info(`Default account found in config file. Setting it as default.`);
                    authPersistence.defaultAccount = account.id;
                }

                if (!account.apiToken) {
                    logger.warn('No PagerDuty API token found in config file. Trying OAuth token instead...');

                    if (!account.oauth) {
                        logger.error('No PagerDuty OAuth configuration found in config file.');
                    } else if (!account.oauth.clientId || !account.oauth.clientSecret || !account.oauth.subDomain) {
                        logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");
                    } else {
                        const tokenInfo : AccountTokenInfo = await getOAuthToken(
                            account.oauth.clientId,
                            account.oauth.clientSecret,
                            account.oauth.subDomain,
                            account.oauth.region ?? 'us');

                        authPersistence.accountTokens[account.id] = tokenInfo;

                        logger.info(`PagerDuty OAuth configuration loaded successfully for account ${maskedAccountId}.`);
                    }
                } else {
                    authPersistence.accountTokens[account.id] = {
                        authToken: `Token token=${account.apiToken}`,
                        authTokenExpiryDate: Date.now() + 3600000 * 24 * 365 * 2 // 2 years
                    };

                    logger.info(`PagerDuty API token loaded successfully for account ${maskedAccountId}.`);
                }
            }));

            if(!authPersistence.defaultAccount){
                logger.error('No default account found in config file. One account must be marked as default.');
            }
        }
    }
    catch (error) {
        logger.error(`Unable to retrieve valid PagerDuty AUTH configuration from config file: ${error}`);
    }
}

async function getOAuthToken(clientId: string, clientSecret: string, subDomain: string, region: string): Promise<AccountTokenInfo> {
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
    urlencoded.append("grant_type", "client_credentials");
    urlencoded.append("client_id", clientId);
    urlencoded.append("client_secret", clientSecret);
    urlencoded.append("scope", `as_account-${region}.${subDomain} ${scopes}`);

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
            throw new HttpError("Failed to retrieve valid token. Bad Request - Invalid arguments provided.", 400);
        case 401:
            throw new HttpError("Failed to retrieve valid token. Forbidden - Invalid credentials provided.", 401);
        default: // 200
            break;
    }

    const authResponse = await response.json();

    const result : AccountTokenInfo = {
        authToken: `Bearer ${authResponse.access_token}`,
        authTokenExpiryDate: Date.now() + (authResponse.expires_in * 1000)
    };

    return result;
}

function maskString(str: string) : string {
    return str[0] + '*'.repeat(str.length - 2) + str.slice(-1);
}