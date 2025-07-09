import { CreateServiceResponse } from '../types';
import { PagerDutyAccountConfig, PagerDutyEscalationPolicy } from '@pagerduty/backstage-plugin-common';
import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
export type LoadEndpointConfigProps = {
    config: RootConfigService | undefined;
    legacyConfig: Config;
    logger: LoggerService;
};
export type PagerDutyEndpointConfig = {
    eventsBaseUrl: string;
    apiBaseUrl: string;
};
export declare function setFallbackEndpointConfig(account: PagerDutyAccountConfig): void;
export declare function insertEndpointConfig(account: PagerDutyAccountConfig): void;
export declare function loadPagerDutyEndpointsFromConfig({ config, legacyConfig, logger, }: LoadEndpointConfigProps): void;
export declare function getApiBaseUrl(account?: string): string;
export type CreateServiceProps = {
    name: string;
    description: string;
    escalationPolicyId: string;
    account?: string;
    alertGrouping?: string;
};
export declare function createService({ name, description, escalationPolicyId, account, alertGrouping, }: CreateServiceProps): Promise<CreateServiceResponse>;
export type CreateServiceIntegrationProps = {
    serviceId: string;
    vendorId: string;
    account?: string;
};
export declare function createServiceIntegration({ serviceId, vendorId, account, }: CreateServiceIntegrationProps): Promise<string>;
export declare function isEventNoiseReductionEnabled(account?: string): Promise<boolean>;
export declare function getAccountByEscalationPolicyId(escalationPolicyId: string): Promise<string>;
export declare function getAllEscalationPolicies(): Promise<PagerDutyEscalationPolicy[]>;
