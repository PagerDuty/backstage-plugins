import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
export type LoadAuthConfigProps = {
    config: RootConfigService | undefined;
    legacyConfig: Config;
    logger: LoggerService;
};
export declare function getAuthToken(accountId?: string): Promise<string>;
export declare function loadAuthConfig({ config, legacyConfig, logger, }: LoadAuthConfigProps): Promise<void>;
