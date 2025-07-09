import type { RequestInit, Response } from 'node-fetch';
import type { EntityMapping } from '../types';
import { DiscoveryService, LoggerService } from '@backstage/backend-plugin-api';
import { PagerDutyEntityMapping, PagerDutyServiceDependency } from '@pagerduty/backstage-plugin-common';
export interface PagerDutyClientOptions {
    discovery: DiscoveryService;
    logger: LoggerService;
}
export type BackstageEntityRef = {
    type: string;
    namespace: string;
    name: string;
};
export declare class PagerDutyClient {
    private discovery;
    private logger;
    private baseUrl;
    constructor({ discovery, logger }: PagerDutyClientOptions);
    addServiceRelationToService(serviceId: string, relations: string[]): Promise<void>;
    removeServiceRelationFromService(serviceId: string, relations: string[]): Promise<void>;
    getAllServiceMappings(): Promise<Record<string, string>>;
    findServiceMapping({ type, namespace, name }: BackstageEntityRef): Promise<EntityMapping | undefined>;
    findServiceMappingById(serviceId: string): Promise<EntityMapping | undefined>;
    insertServiceMapping(mapping: PagerDutyEntityMapping): Promise<void>;
    getServiceDependencies(serviceId: string, account?: string): Promise<PagerDutyServiceDependency[]>;
    getServiceIdAnnotationFromCatalog(entityRef: string): Promise<string>;
    getServiceIdFromIntegrationKey(integrationKey: string, account?: string): Promise<string>;
    getIntegrationKeyFromServiceId(serviceId: string, account?: string): Promise<string | undefined>;
    getServiceDependencyStrategySetting(): Promise<string>;
}
export declare function fetchWithRetries(url: string, options: RequestInit): Promise<Response>;
