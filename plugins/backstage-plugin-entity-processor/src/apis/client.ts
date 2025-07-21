import fetch from 'node-fetch';
import type {
    RequestInit,
    Response
} from 'node-fetch';
import type { EntityMapping } from '../types';
import {
    DiscoveryService,
    LoggerService
} from '@backstage/backend-plugin-api';
import {
    PagerDutyEntityMapping,
    PagerDutyEntityMappingResponse,
    PagerDutyServiceResponse,
    PagerDutyServiceDependency,
    PagerDutyServiceDependencyResponse,
    PagerDutySetting,
    PagerDutyEntityMappingsResponse,
} from '@pagerduty/backstage-plugin-common';

export interface PagerDutyClientOptions {
    discovery: DiscoveryService;
    logger: LoggerService;
};

export type BackstageEntityRef = {
    type: string;
    namespace: string;
    name: string;
}

export class PagerDutyClient {
    private discovery: DiscoveryService;
    private logger: LoggerService;
    private baseUrl: string = "";

    constructor({ discovery, logger }: PagerDutyClientOptions) {
        this.discovery = discovery;
        this.logger = logger;
    }

    async addServiceRelationToService(serviceId: string, relations: string[]) : Promise<void> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
            body: JSON.stringify(relations),
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/dependencies/service/${serviceId}`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to add service relation to service ${serviceId}. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
            }

            if (!response.ok) {
                throw new Error(await response.text());
            }
        } catch (error) {
            this.logger.error(`Failed to add dependencies: ${error}`);
            throw new Error(`Failed to add dependencies: ${error}`);
        }
    }

    async removeServiceRelationFromService(serviceId: string, relations: string[]): Promise<void> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
            body: JSON.stringify(relations),
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/dependencies/service/${serviceId}`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to remove service relation from service ${serviceId}. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
            }

            if (response.status === 404) {
                throw new Error(`Service ${serviceId} or dependencies not found.`);
            }

            if (!response.ok) {
                throw new Error(await response.text());
            }
        } catch (error) {
            this.logger.error(`Failed to remove dependencies from ${serviceId}: ${error}`);
            throw new Error(`Failed to remove dependencies from ${serviceId}: ${error}`);
        }
    }

    async getAllServiceMappings(): Promise<Record<string, string>> {
        let response: Response;
        const mappings: Record<string, string> = {};

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/mapping/entity`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to get all service mappings. API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundMappings: PagerDutyEntityMappingsResponse = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return mappings;
                default: // 200
                    foundMappings.mappings.forEach(mapping => {
                        mappings[mapping.serviceId] = mapping.entityRef;
                    });

                    return mappings;
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve mappings: ${error}`);
            throw new Error(`Failed to retrieve mappings: ${error}`);
        }
    }

    async findServiceMapping({ type, namespace, name }: BackstageEntityRef): Promise<EntityMapping | undefined> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/mapping/entity/${type}/${namespace}/${name}`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to find service mapping. API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundMapping: PagerDutyEntityMappingResponse = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return undefined;
                default: // 200
                    this.logger.debug(`Found mapping for ${type}:${namespace}/${name}: ${JSON.stringify(foundMapping.mapping)}`);

                    return {
                        serviceId: foundMapping.mapping.serviceId,
                        integrationKey: foundMapping.mapping.integrationKey,
                        entityRef: foundMapping.mapping.entityRef,
                        account: foundMapping.mapping.account,
                    }
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve mapping for ${type}:${namespace}/${name}: ${error}`);
            throw new Error(`Failed to retrieve mapping for ${type}:${namespace}/${name}: ${error}`);
        }
    }

    async findServiceMappingById(serviceId: string): Promise<EntityMapping | undefined> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/mapping/entity/service/${serviceId}`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to find service mapping by id. API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundMapping: PagerDutyEntityMappingResponse = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return undefined;
                default: // 200
                    this.logger.debug(`Found mapping for serviceId ${serviceId}: ${JSON.stringify(foundMapping.mapping)}`);

                    return {
                        serviceId: foundMapping.mapping.serviceId,
                        integrationKey: foundMapping.mapping.integrationKey,
                        entityRef: foundMapping.mapping.entityRef,
                        account: foundMapping.mapping.account,
                    };
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve mapping for serviceId ${serviceId}: ${error}`);
            throw new Error(`Failed to retrieve mapping for serviceId ${serviceId}: ${error}`);
        }
    }

    async insertServiceMapping(mapping: PagerDutyEntityMapping): Promise<void> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
            body: JSON.stringify(mapping),
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/mapping/entity`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to add service mapping. API returned a server error. Retrying with the same arguments will not work.`);
            }

            if (!response.ok) {
                throw new Error(await response.text());
            }
        } catch (error) {
            this.logger.error(`Failed to add mapping for ${mapping.entityRef}: ${error}`);
            throw new Error(`Failed to add mapping for ${mapping.entityRef}: ${error}`);
        }
    }

    async getServiceDependencies(serviceId: string, account?: string): Promise<PagerDutyServiceDependency[]> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        let url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/dependencies/service/${serviceId}`;

        if (account) {
            url = url.concat(`?account=${account}`);
        }

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to get service depedencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundDependencies: PagerDutyServiceDependencyResponse = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return [];
                default: // 200
                    return foundDependencies.relationships;
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve mapping for ${serviceId}: ${error}`);
            throw new Error(`Failed to retrieve mapping for ${serviceId}: ${error}`);
        }
    }

    async getServiceIdAnnotationFromCatalog(entityRef: string): Promise<string> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        // extract type, namespace and name from type:namespace/name
        const [type, rest] = entityRef.split(':');
        const [namespace, name] = rest.split('/');

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/catalog/entity/${type}/${namespace}/${name}`;

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to get service id annotation from catalog. API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundServiceId: string = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return "";
                default: // 200
                    return foundServiceId;
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve a PagerDuty service id for ${entityRef}: ${error}`);
            throw new Error(`Failed to retrieve a PagerDuty service id for ${entityRef}: ${error}`);
        }
    }

    async getServiceIdFromIntegrationKey(integrationKey: string, account?: string): Promise<string> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        let url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/services?integration_key=${integrationKey}`;

        if (account) {
            url = url.concat(`&account=${account}`);
        }

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to get service id from integration key ${integrationKey}. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundService: PagerDutyServiceResponse = await response.json();

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return "";
                default: // 200
                    return foundService.service.id;
            }
        } catch (error) {
            this.logger.error(`Failed to retrieve a PagerDuty service id for integration key ${integrationKey}: ${error}`);
            throw new Error(`Failed to retrieve a PagerDuty service id for integration key ${integrationKey}: ${error}`);
        }
    }

    async getIntegrationKeyFromServiceId(serviceId: string, account?: string): Promise<string | undefined> {
        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        let url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/services/${serviceId}`;

        if (account) {
            url = url.concat(`?account=${account}`);
        }

        try {
            response = await fetchWithRetries(url, options);

            if (response.status >= 500) {
                throw new Error(`Failed to get integration key from service id ${serviceId}. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
            }

            const foundService: PagerDutyServiceResponse = await response.json();
            const backstageIntegration = foundService.service.integrations?.find(integration => integration.vendor?.id === "PRO19CT");

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return "";
                default: // 200

                    if (!backstageIntegration) {
                        return undefined;
                    }

                    return backstageIntegration.integration_key;
            }
        } catch (error) {
            this.logger.error(`No Backstage integration found for service id ${serviceId}: ${error}`);
            throw new Error(`No Backstage integration found for service id ${serviceId}: ${error}`);
        }
    }

    async getServiceDependencyStrategySetting(): Promise<string> {
        const SERVICE_DEPENDENCY_SYNC_STRATEGY = "settings::service-dependency-sync-strategy";

        let response: Response;

        if (this.baseUrl === "") {
            this.baseUrl = await this.discovery.getBaseUrl('pagerduty');
        }

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
            },
        };

        const url = `${await this.discovery.getBaseUrl(
            'pagerduty',
        )}/settings/${SERVICE_DEPENDENCY_SYNC_STRATEGY}`;

        try {
            response = await fetchWithRetries(url, options);          

            if (response.status >= 500) {
                throw new Error(`Failed to get service depedency strategy. API returned a server error. Retrying with the same arguments will not work.`);
            }

            const setting: PagerDutySetting = await response.json();  

            switch (response.status) {
                case 400:
                    throw new Error(await response.text());
                case 404:
                    return "disabled"; // if setting does not exist in the database, default to disabled
                default: // 200
                    return setting.value;
            }
        } catch (error) {
            this.logger.error(`Error getting value for setting: ${error}`);
            throw new Error(`Error getting value for setting: ${error}`);
        }
    }
}

export async function fetchWithRetries(url: string, options: RequestInit): Promise<Response> {
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

    throw new Error(`Failed to fetch data after ${maxRetries} retries. Last error: ${error}`);
}