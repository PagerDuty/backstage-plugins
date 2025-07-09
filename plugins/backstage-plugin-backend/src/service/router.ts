import {
    AuthService,
    DiscoveryService,
    LoggerService,
    RootConfigService
} from '@backstage/backend-plugin-api';
import {
    createLegacyAuthAdapters,
    errorHandler
} from '@backstage/backend-common';
import {
    getAllEscalationPolicies,
    getChangeEvents,
    getIncidents,
    getOncallUsers,
    getServiceById,
    getServiceByIntegrationKey,
    getServiceStandards,
    getServiceMetrics,
    getAllServices,
    loadPagerDutyEndpointsFromConfig,
    createServiceIntegration,
    getServiceRelationshipsById,
    addServiceRelationsToService,
    removeServiceRelationsFromService
} from '../apis/pagerduty';
import {
    HttpError,
    PagerDutyChangeEventsResponse,
    PagerDutyIncidentsResponse,
    PagerDutyOnCallUsersResponse,
    PagerDutyServiceResponse,
    PagerDutyServiceStandardsResponse,
    PagerDutyServiceMetricsResponse,
    PagerDutyServicesResponse,
    PagerDutyEntityMapping,
    PagerDutyEntityMappingsResponse,
    PagerDutyService,
    PagerDutyServiceDependency,
    PagerDutySetting
} from '@pagerduty/backstage-plugin-common';
import { loadAuthConfig } from '../auth/auth';
import {
    PagerDutyBackendStore,
    RawDbEntityResultRow
} from '../db/PagerDutyBackendDatabase';
import * as express from 'express';
import Router from 'express-promise-router';
import type {
    CatalogApi,
    GetEntitiesResponse
} from '@backstage/catalog-client';


export interface RouterOptions {
    logger: LoggerService;
    config: RootConfigService;
    store: PagerDutyBackendStore;
    discovery: DiscoveryService;
    auth?: AuthService;
    catalogApi?: CatalogApi;
}

export type Annotations = {
    "pagerduty.com/integration-key": string;
    "pagerduty.com/service-id": string;
    "pagerduty.com/account": string;
}

export async function createComponentEntitiesReferenceDict({ items: componentEntities }: GetEntitiesResponse): Promise<Record<string, { ref: string, name: string }>> {
    const componentEntitiesDict: Record<string, { ref: string, name: string }> = {};

    await Promise.all(componentEntities.map(async (entity) => {
        const serviceId = entity.metadata.annotations?.['pagerduty.com/service-id'];
        const integrationKey = entity.metadata.annotations?.['pagerduty.com/integration-key'];
        const account = entity.metadata.annotations?.['pagerduty.com/account'];

        if (serviceId !== undefined && serviceId !== "") {
            componentEntitiesDict[serviceId] = {
                ref: `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase(),
                name: entity.metadata.name,
            };
        }
        else if (integrationKey !== undefined && integrationKey !== "") {
            // get service id from integration key, we ignore errors here since we're focused
            // only on building a mapping between valid service IDs and the corresponding Backstage entity
            const service = await getServiceByIntegrationKey(integrationKey, account).catch(() => undefined);

            if (service !== undefined) {
                componentEntitiesDict[service.id] = {
                    ref: `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase(),
                    name: entity.metadata.name,
                };
            }
        }
    }));

    return componentEntitiesDict;
}

export async function buildEntityMappingsResponse(
    entityMappings: RawDbEntityResultRow[],
    componentEntitiesDict: Record<string, {
        ref: string;
        name: string;
    }>,
    componentEntities: GetEntitiesResponse,
    pagerDutyServices: PagerDutyService[]
): Promise<PagerDutyEntityMappingsResponse> {

    const result: PagerDutyEntityMappingsResponse = {
        mappings: []
    };

    pagerDutyServices.forEach((service) => {
        // Check for service mapping annotation in any entity config file and get the entity ref
        const entityRef = componentEntitiesDict[service.id]?.ref;
        const entityName = componentEntitiesDict[service.id]?.name;

        // Check if the service is mapped to an entity in the database
        const entityMapping = entityMappings.find((mapping) => mapping.serviceId === service.id);

        if (entityMapping) {
            if (entityRef === undefined) {
                if (entityMapping.entityRef === "" || entityMapping.entityRef === undefined) {
                    result.mappings.push({
                        entityRef: "",
                        entityName: "",
                        integrationKey: entityMapping.integrationKey,
                        serviceId: entityMapping.serviceId,
                        status: "NotMapped",
                        serviceName: service.name,
                        team: service.teams?.[0]?.name ?? "",
                        escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                        serviceUrl: service.html_url,
                        account: service.account,
                    });
                }
                else {
                    const entityRefName = componentEntities.items.find((entity) => `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() === entityMapping.entityRef)?.metadata.name ?? "";

                    result.mappings.push({
                        entityRef: entityMapping.entityRef,
                        entityName: entityRefName,
                        serviceId: entityMapping.serviceId,
                        integrationKey: entityMapping.integrationKey,
                        status: "OutOfSync",
                        serviceName: service.name,
                        team: service.teams?.[0]?.name ?? "",
                        escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                        serviceUrl: service.html_url,
                        account: service.account,
                    });
                }
            } else if (entityRef !== entityMapping.entityRef) {
                const entityRefName = componentEntities.items.find((entity) => `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() === entityMapping.entityRef)?.metadata.name ?? "";

                result.mappings.push({
                    entityRef: entityMapping.entityRef !== "" ? entityMapping.entityRef : "",
                    entityName: entityMapping.entityRef !== "" ? entityRefName : "",
                    serviceId: entityMapping.serviceId,
                    integrationKey: entityMapping.integrationKey,
                    status: "OutOfSync",
                    serviceName: service.name,
                    team: service.teams?.[0]?.name ?? "",
                    escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                    serviceUrl: service.html_url,
                    account: service.account,
                });
            } else if (entityRef === entityMapping.entityRef) {
                result.mappings.push({
                    entityRef: entityMapping.entityRef !== "" ? entityMapping.entityRef : "",
                    entityName: entityMapping.entityRef !== "" ? entityName : "",
                    serviceId: entityMapping.serviceId,
                    integrationKey: entityMapping.integrationKey,
                    status: "InSync",
                    serviceName: service.name,
                    team: service.teams?.[0]?.name ?? "",
                    escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                    serviceUrl: service.html_url,
                    account: service.account,
                });
            }
        } else {
            const backstageVendorId = 'PRO19CT';
            const backstageIntegrationKey = service.integrations?.find((integration) => integration.vendor?.id === backstageVendorId)?.integration_key ?? "";

            if (entityRef !== undefined) {
                result.mappings.push({
                    entityRef: entityRef,
                    entityName: entityName,
                    serviceId: service.id,
                    integrationKey: backstageIntegrationKey,
                    status: "InSync",
                    serviceName: service.name,
                    team: service.teams?.[0]?.name ?? "",
                    escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                    serviceUrl: service.html_url,
                    account: service.account,
                });
            } else {
                result.mappings.push({
                    entityRef: "",
                    entityName: "",
                    serviceId: service.id,
                    integrationKey: backstageIntegrationKey,
                    status: "NotMapped",
                    serviceName: service.name,
                    team: service.teams?.[0]?.name ?? "",
                    escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : "",
                    serviceUrl: service.html_url,
                    account: service.account,
                });
            }
        }
    });

    const sortedResult = result.mappings.sort((a, b) => {
        if (a.serviceName! < b.serviceName!) { return -1; }
        else if (a.serviceName! > b.serviceName!) { return 1; }
        return 0;
    });

    result.mappings = sortedResult;

    return result;
}

export async function createRouter(
    options: RouterOptions
): Promise<express.Router> {
    const { logger, config, store, catalogApi } = options;
    let { auth } = options;

    if (!auth) {
        auth = createLegacyAuthAdapters(options).auth;
    }

    // Get authentication Config
    await loadAuthConfig(config, logger);

    // Get optional PagerDuty custom endpoints from config
    loadPagerDutyEndpointsFromConfig(config, logger);

    // Create the router
    const router = Router();
    router.use(express.json());

    // DELETE /dependencies/service/:serviceId
    router.delete('/dependencies/service/:serviceId', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId = request.params.serviceId || '';
            const account = request.query.account as string || '';

            if(serviceId === '') {
                response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
                return;
            }

            const dependencies: string[] = Object.keys(request.body).length === 0 ? [] : request.body;
            if(!dependencies || dependencies.length === 0) {
                response.status(400).json("Bad Request: 'dependencies' must be provided as part of the request body");
                return;
            }

            const serviceRelations : PagerDutyServiceDependency[] = [];

            dependencies.forEach(async (dependency) => {
                serviceRelations.push({
                    supporting_service: {
                        id: dependency,
                        type: "service"
                    },
                    dependent_service: {
                        id: serviceId,
                        type: "service"
                    }
                });
            });

            await removeServiceRelationsFromService(serviceRelations, account);
            
            response.sendStatus(200);

        } catch (error) {
            if (error instanceof HttpError) {
                logger.error(`Error occurred while processing request: ${error.message}`);
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // POST /dependencies/service/:serviceId
    router.post('/dependencies/service/:serviceId', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId = request.params.serviceId || '';
            const account = request.query.account as string || '';

            if(serviceId === '') {
                response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
                return;
            }

            const dependencies: string[] = Object.keys(request.body).length === 0 ? [] : request.body;
            if(!dependencies || dependencies.length === 0) {
                response.status(400).json("Bad Request: 'dependencies' must be provided as part of the request body");
                return;
            }

            const serviceRelations : PagerDutyServiceDependency[] = [];

            dependencies.forEach(async (dependency) => {
                serviceRelations.push({
                    supporting_service: {
                        id: dependency,
                        type: "service"
                    },
                    dependent_service: {
                        id: serviceId,
                        type: "service"
                    }
                });
            });

            await addServiceRelationsToService(serviceRelations, account);
            
            response.sendStatus(200);

        } catch (error) {
            if (error instanceof HttpError) {
                logger.error(`Error occurred while processing request: ${error.message}`);
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });


    router.get('/dependencies/service/:serviceId', async (request, response) => {
        try {
            const serviceId = request.params.serviceId;
            const account = request.query.account as string || '';

            if (serviceId) {
                const serviceRelationships: PagerDutyServiceDependency[] = await getServiceRelationshipsById(serviceId, account);

                if (serviceRelationships) {
                    response.json({
                        relationships: serviceRelationships
                    });
                }
            }
            else {
                response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
            }
        }
        catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /catalog/entity/:entityRef
    router.get('/catalog/entity/:type/:namespace/:name', async (request, response) => {
        const type = request.params.type;
        const namespace = request.params.namespace;
        const name = request.params.name;

        try {
            if (type && namespace && name) {
                const entityRef = `${type}:${namespace}/${name}`.toLowerCase();
                const foundEntity = await catalogApi?.getEntityByRef(entityRef);

                if (foundEntity) {
                    response.json(foundEntity.metadata.annotations?.["pagerduty.com/service-id"]);

                }
                else {
                    response.status(404);
                }
            }
            else {
                response.status(400).json("Bad Request: ':entityRef' must be provided as part of the path");
            }
        }
        catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // POST /settings
    router.post('/settings', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const settings : PagerDutySetting[] = request.body;

            // For each setting, update or insert the value in the database
            await Promise.all(settings.map(async (setting) => {
                if(setting.id === undefined || setting.value === undefined) {
                    response.status(400).json("Bad Request: 'id' and 'value' are required");
                    return;
                }

                if(!isValidSetting(setting.value)) {
                    response.status(400).json("Bad Request: 'value' is invalid. Valid options are 'backstage', 'pagerduty', 'both' or 'disabled'");
                    return;
                }

                await store.updateSetting(setting);
            }));

            response.sendStatus(200);

        } catch (error) {
            if (error instanceof HttpError) {
                logger.error(`Error occurred while processing request: ${error.message}`);
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /settings/:settingId
    router.get('/settings/:settingId', async (request, response) => {
        try {
            // Get param from the request
            const settingId = request.params.settingId;
        
            // Find setting by id
            const setting = await store.findSetting(settingId);

            if (!setting) {
                response.status(404).json({});
                return;
            }

            response.json(setting);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    function isValidSetting(value: string): boolean {
        if(value === "backstage" || value === "pagerduty" || value === "both" || value === "disabled") {
            return true;
        }

        return false;
    }

    // POST /mapping/entity
    router.post('/mapping/entity', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const entity: PagerDutyEntityMapping = request.body;

            if (!entity.serviceId) {
                response.status(400).json("Bad Request: 'serviceId' must be provided as part of the request body");
                return;
            }

            // Get all the entity mappings from the database
            const entityMappings = await store.getAllEntityMappings();
            const oldMapping = entityMappings.find((mapping) => mapping.serviceId === entity.serviceId);

            // in case a mapping is defined and no integration exists, 
            // we need to create one
            if (entity.entityRef !== "" &&
                (entity.integrationKey === "" || entity.integrationKey === undefined)) {

                const backstageVendorId = 'PRO19CT';
                // check for existing integration key on service
                const service = await getServiceById(entity.serviceId, entity.account);
                const backstageIntegration = service.integrations?.find((integration) => integration.vendor?.id === backstageVendorId);

                if (!backstageIntegration) {
                    // If an integration does not exist for service,                
                    // create it in PagerDuty
                    const integrationKey = await createServiceIntegration({
                        serviceId: entity.serviceId,
                        vendorId: backstageVendorId,
                        account: entity.account
                    });

                    entity.integrationKey = integrationKey;
                } else {
                    entity.integrationKey = backstageIntegration.integration_key;
                }
            }

            const entityMappingId = await store.insertEntityMapping(entity);

            // Refresh new and old entity unless they are empty strings
            if (entity.entityRef !== "") {
                // force refresh of new entity
                await catalogApi?.refreshEntity(entity.entityRef);
            }

            if (oldMapping && oldMapping.entityRef !== "") {
                // force refresh of old entity
                await catalogApi?.refreshEntity(oldMapping.entityRef);
            }

            response.json({
                id: entityMappingId,
                entityRef: entity.entityRef,
                integrationKey: entity.integrationKey,
                serviceId: entity.serviceId,
                status: entity.status,
                account: entity.account,
            });
        } catch (error) {
            if (error instanceof HttpError) {
                logger.error(`Error occurred while processing request: ${error.message}`);
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /mapping/entity
    router.get('/mapping/entity', async (_, response) => {
        try {
            // Get all the entity mappings from the database
            const entityMappings = await store.getAllEntityMappings();

            // Get all the entities from the catalog
            const componentEntities = await catalogApi!.getEntities({
                filter: {
                    kind: 'Component',
                }
            });

            // Build reference dictionary of componentEntities with serviceId as the key and entity reference and name pair as the value
            const componentEntitiesDict: Record<string, { ref: string, name: string }> = await createComponentEntitiesReferenceDict(componentEntities);

            // Get all services from PagerDuty
            const pagerDutyServices = await getAllServices();

            // Build the response object
            const result: PagerDutyEntityMappingsResponse = await buildEntityMappingsResponse(entityMappings, componentEntitiesDict, componentEntities, pagerDutyServices);

            response.json(result);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /mapping/entity
    router.get('/mapping/entity/:type/:namespace/:name', async (request, response) => {
        try {
            // Get the type, namespace and entity name from the request parameters
            const entityType: string = request.params.type || '';
            const entityNamespace: string = request.params.namespace || '';
            const entityName: string = request.params.name || '';

            if (entityType === ''
                || entityNamespace === ''
                || entityName === '') {
                response.status(400).json("Required params not specified.");
                return;
            }

            const entityRef = `${entityType}:${entityNamespace}/${entityName}`.toLowerCase();

            // Get all the entity mappings from the database
            const entityMapping = await store.findEntityMappingByEntityRef(entityRef);

            if (!entityMapping) {
                response.status(404).json(`Mapping for entityRef ${entityRef} not found.`);
                return;
            }

            response.json({
                mapping: entityMapping
            });

        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /mapping/entity/service/:serviceId
    router.get('/mapping/entity/service/:serviceId', async (request, response) => {
        try {
            // Get the type, namespace and entity name from the request parameters
            const serviceId: string = request.params.serviceId ?? '';

            if (serviceId === '') {
                response.status(400).json("Required params not specified.");
                return;
            }

            // Get all the entity mappings from the database
            const entityMapping = await store.findEntityMappingByServiceId(serviceId);

            if (!entityMapping) {
                response.status(404).json(`Mapping for serviceId ${serviceId} not found.`);
                return;
            }

            response.json({
                mapping: entityMapping
            });

        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /escalation_policies
    router.get('/escalation_policies', async (_, response) => {

        try {
            let escalationPolicyList = await getAllEscalationPolicies();

            // sort the escalation policies by account and name
            escalationPolicyList = escalationPolicyList.sort((a, b) => {
                if (a.account === b.account) {
                    return a.name.localeCompare(b.name);
                }
                return a.account!.localeCompare(b.account!);
            });

            const escalationPolicyDropDownOptions = escalationPolicyList.map((policy) => {
                let policyLabel = policy.name;
                if (policy.account && policy.account !== 'default') {
                    policyLabel = `(${policy.account}) ${policy.name}`;
                }

                return {
                    label: policyLabel,
                    value: policy.id,
                };
            });

            response.json(escalationPolicyDropDownOptions);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /oncall
    router.get('/oncall-users', async (request, response) => {
        try {
            // Get the escalation policy ID from the request parameters with parameter name "escalation_policy_ids[]"
            const escalationPolicyId: string = request.query.escalation_policy_ids as string || '';
            const account = request.query.account as string || '';

            if (escalationPolicyId === '') {
                response.status(400).json("Bad Request: 'escalation_policy_ids[]' is required");
                return;
            }

            const oncallUsers = await getOncallUsers(escalationPolicyId, account);
            const onCallUsersResponse: PagerDutyOnCallUsersResponse = {
                users: oncallUsers
            };

            response.json(onCallUsersResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services/:serviceId
    router.get('/services/:serviceId', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId: string = request.params.serviceId || '';
            const account = request.query.account as string || '';

            if (serviceId === '') {
                response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path or 'integration_key' as a query parameter");
                return;
            }

            const service = await getServiceById(serviceId, account);
            const serviceResponse: PagerDutyServiceResponse = {
                service: service
            }

            response.json(serviceResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services?integration_key=:integrationKey
    router.get('/services', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const integrationKey: string = request.query.integration_key as string || '';
            const account = request.query.account as string || '';

            if (integrationKey !== '') {
                const service = await getServiceByIntegrationKey(integrationKey, account);
                const serviceResponse: PagerDutyServiceResponse = {
                    service: service
                }

                response.json(serviceResponse);
            } else {
                const services = await getAllServices();
                const servicesResponse: PagerDutyServicesResponse = {
                    services: services
                }

                response.json(servicesResponse);
            }
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // POST /services/:serviceId/integration/:vendorId
    router.post('/services/:serviceId/integration/:vendorId', async (request, response) => {
        try {
            const serviceId: string = request.params.serviceId || '';
            const vendorId: string = request.params.vendorId || '';
            const account = request.query.account as string || '';

            if (serviceId === '' || vendorId === '') {
                response.status(400).json("Bad Request: ':serviceId' and ':vendorId' must be provided as part of the path");
                return;
            }

            const integrationKey = await createServiceIntegration({
                serviceId,
                vendorId,
                account
            });

            response.json(integrationKey);
        } catch (error) {
            if (error instanceof HttpError) {
                logger.error(`Error occurred while processing request: ${error.message}`);
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services/:serviceId/change-events
    router.get('/services/:serviceId/change-events', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId: string = request.params.serviceId || '';
            const account = request.query.account as string || '';

            const changeEvents = await getChangeEvents(serviceId, account);
            const changeEventsResponse: PagerDutyChangeEventsResponse = {
                change_events: changeEvents
            }

            response.json(changeEventsResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services/:serviceId/incidents
    router.get('/services/:serviceId/incidents', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId: string = request.params.serviceId || '';
            const account = request.query.account as string || '';

            const incidents = await getIncidents(serviceId, account);
            const incidentsResponse: PagerDutyIncidentsResponse = {
                incidents
            }

            response.json(incidentsResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services/:serviceId/standards
    router.get('/services/:serviceId/standards', async (request, response) => {
        try {

            // Get the serviceId from the request parameters
            const serviceId: string = request.params.serviceId || '';
            const account = request.query.account as string || '';

            const serviceStandards = await getServiceStandards(serviceId, account);
            const serviceStandardsResponse: PagerDutyServiceStandardsResponse = {
                standards: serviceStandards
            }

            response.json(serviceStandardsResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /services/:serviceId/metrics
    router.get('/services/:serviceId/metrics', async (request, response) => {
        try {
            // Get the serviceId from the request parameters
            const serviceId: string = request.params.serviceId || '';
            const account = request.query.account as string || '';

            const metrics = await getServiceMetrics(serviceId, account);


            const metricsResponse: PagerDutyServiceMetricsResponse = {
                metrics: metrics
            };

            response.json(metricsResponse);

        } catch (error) {
            if (error instanceof HttpError) {
                response.status(error.status).json({
                    errors: [
                        `${error.message}`
                    ]
                });
            }
        }
    });

    // GET /health
    router.get('/health', async (_, response) => {
        response.status(200).json({ status: 'ok' });
    });

    // Add error handler
    router.use(errorHandler());

    // Return the router
    return router;
}
