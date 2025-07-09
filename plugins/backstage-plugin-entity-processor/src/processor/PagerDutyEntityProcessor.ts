import { DiscoveryService, LoggerService } from "@backstage/backend-plugin-api";
import { Entity, RELATION_DEPENDS_ON, RELATION_DEPENDENCY_OF } from "@backstage/catalog-model";
import { CatalogProcessor, CatalogProcessorEmit, processingResult } from "@backstage/plugin-catalog-node";
import { LocationSpec } from "@backstage/plugin-catalog-common";
import { PagerDutyClient } from "../apis/client";

/**
 * A function which given an entity, determines if it should be processed for linguist tags.
 * @public
 */
export type ShouldProcessEntity = (entity: Entity) => boolean;

export interface PagerDutyEntityProcessorOptions {
    logger: LoggerService;
    discovery: DiscoveryService;
};

let client: PagerDutyClient;

export class PagerDutyEntityProcessor implements CatalogProcessor {
    private logger: LoggerService;
    private discovery: DiscoveryService;

    private shouldProcessEntity: ShouldProcessEntity = (entity: Entity) => {
        return entity.kind === 'Component';
    }

    constructor({ logger, discovery }: PagerDutyEntityProcessorOptions) {
        this.logger = logger;
        this.discovery = discovery;

        client = new PagerDutyClient({ discovery: this.discovery, logger: this.logger });
    }

    getProcessorName(): string {
        return "PagerDutyEntityProcessor";
    }

    async preProcessEntity(entity: Entity): Promise<Entity> {
        if (this.shouldProcessEntity(entity)) {
            const strategySetting = await client.getServiceDependencyStrategySetting();

            if (strategySetting && strategySetting === "pagerduty") {
                if (entity.spec?.dependsOn){
                    // empty the dependsOn array
                    entity.spec.dependsOn = [];
                }
            }
        }

        return entity;
    }

    async postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity> {
        if (this.shouldProcessEntity(entity)) {
            try {
                // Process service mapping overrides
                // Find the service mapping for the entity in database
                const mapping = await client.findServiceMapping({
                    type: entity.kind.toLowerCase(),
                    namespace: entity.metadata.namespace!.toLowerCase(),
                    name: entity.metadata.name.toLowerCase(),
                });

                // If mapping exists add the annotations to the entity
                if (mapping) {
                    updateAnnotations(entity,
                        {
                            serviceId: mapping.serviceId,
                            integrationKey: mapping.integrationKey,
                            account: mapping.account
                        }
                    );

                    this.logger.debug(`Added annotations to entity ${entity.metadata.name} with service id: ${mapping.serviceId}, integration key: ${mapping.integrationKey} and account: ${mapping.account}`);
                } else {
                    this.logger.debug(`No mapping found for entity: ${entity.metadata.name}. Adding annotations to the database.`);

                    // Add the mapping to the database based on entity annotations
                    let serviceId = entity.metadata.annotations?.["pagerduty.com/service-id"];
                    let integrationKey = entity.metadata.annotations?.["pagerduty.com/integration-key"];
                    const account = entity.metadata.annotations?.["pagerduty.com/account"];

                    // Build the entityRef string
                    const entityRef = `${entity.kind.toLowerCase()}:${entity.metadata.namespace?.toLowerCase()}/${entity.metadata.name.toLowerCase()}`;

                    if (serviceId) {
                        // Check for mapping override by user
                        const serviceMappingOverrideFound = await client.findServiceMappingById(serviceId);

                        // If service mapping override is not found
                        // insert the mapping into the database
                        if (!serviceMappingOverrideFound) {
                            // if integrationKey annotation does not exist
                            // try to retrieve it from PagerDuty
                            if (!integrationKey) {
                                const foundIntegrationKey = await client.getIntegrationKeyFromServiceId(serviceId, account);

                                if (foundIntegrationKey) {
                                    integrationKey = foundIntegrationKey;
                                }
                            }

                            // Insert the mapping into the database
                            this.logger.debug(`Inserting mapping for entity: ${entityRef} with service id: ${serviceId}, integration key: ${integrationKey} and account: ${account}`);
                            await client.insertServiceMapping({
                                entityRef,
                                serviceId,
                                integrationKey,
                                account,
                            });

                            // Add the annotations to the entity
                            updateAnnotations(entity,
                                {
                                    serviceId,
                                    integrationKey,
                                    account
                                }
                            );
                        }
                        else {
                            this.logger.debug(`Service mapping override found for service id: ${serviceId}.`);
                            updateAnnotations(entity, {}); // delete annotations because user unmapped the service
                        }
                    }
                    else if (integrationKey) {
                        serviceId = await client.getServiceIdFromIntegrationKey(integrationKey, account);

                        // Check for mapping override by user
                        const serviceMappingOverrideFound = await client.findServiceMappingById(serviceId);

                        // If service mapping override is not found
                        // insert the mapping into the database
                        if (!serviceMappingOverrideFound) {
                            // Insert the mapping into the database
                            this.logger.debug(`Inserting mapping for entity: ${entityRef} with new service id: ${serviceId}, integration key: ${integrationKey} and account: ${account}`);
                            await client.insertServiceMapping({
                                entityRef,
                                serviceId,
                                integrationKey,
                                account,
                            });

                            updateAnnotations(entity,
                                {
                                    serviceId,
                                    integrationKey,
                                    account
                                }
                            );
                        }
                        else {
                            this.logger.debug(`Service mapping override found for service id: ${serviceId}. Skipping adding to the database.`);
                            updateAnnotations(entity, {}); // delete annotations because user unmapped the service
                        }
                    }
                }

                // Process service dependencies
                // if (entity.spec?.dependsOn) {
                // Check if ServiceId exists get service dependencies from PagerDuty 
                const serviceId = entity.metadata.annotations?.["pagerduty.com/service-id"];

                if (serviceId) {
                    const strategySetting = await client.getServiceDependencyStrategySetting();

                    if (strategySetting && strategySetting !== "disabled") {
                        // Check if service has dependencies configured
                        let dependencyAnnotations: string[] = [];

                        if (entity.spec?.dependsOn) {
                            dependencyAnnotations = JSON.parse(JSON.stringify(entity.spec?.dependsOn));
                        }

                        const mappings = await client.getAllServiceMappings();

                        const entityDependencies: string[] = await buildExistingDependencies(dependencyAnnotations);

                        // Get dependencies from PagerDuty for the service
                        const account = entity.metadata.annotations?.["pagerduty.com/account"];
                        const dependencies = await client.getServiceDependencies(serviceId, account);
                        const filteredDependencies = dependencies.filter(x => x.dependent_service.id === serviceId);
                        const dependencyIds = filteredDependencies.map(x => x.supporting_service.id);

                        // compare dependencies with existing dependencies defined on the entity
                        const dependenciesMissingInBackstage = dependencyIds.filter(x => !entityDependencies.includes(x));
                        const dependenciesMissingInPagerDuty = entityDependencies.filter(x => !dependencyIds.includes(x));

                        switch (strategySetting) {
                            case "backstage":
                                // Update dependencies on PagerDuty with dependenciesMissinginPagerDuty
                                // Add dependency associations in PagerDuty
                                if (dependenciesMissingInPagerDuty.length > 0) {
                                    this.logger.debug(`Updating dependencies on PagerDuty with: ${JSON.stringify(dependenciesMissingInPagerDuty)}`);
                                    await client.addServiceRelationToService(serviceId, dependenciesMissingInPagerDuty);
                                }

                                // Remove dependency associations in PagerDuty
                                if (dependenciesMissingInBackstage.length > 0) {
                                    this.logger.debug(`Removing dependencies on PagerDuty with: ${JSON.stringify(dependenciesMissingInBackstage)}`);
                                    await client.removeServiceRelationFromService(serviceId, dependenciesMissingInBackstage);
                                }

                                break;
                            case "pagerduty":
                                // Update dependencies on Backstage with dependenciesMissingInBackstage
                                
                                // !!!
                                // This is not supported yet due to a limitation on Backstage side
                                // that prevents a full override of the dependencies once they are
                                // set on the entity configuration file
                                // !!!

                                entity.spec!.dependsOn = refreshServiceDependencyAnnotations(entity, mappings, dependencyIds, emit);

                                break;
                            case "both":
                                // Update dependencies in both PagerDuty and Backstage
                                this.logger.debug(`Updating dependencies on PagerDuty with: ${JSON.stringify(dependenciesMissingInPagerDuty)} and Backstage with: ${JSON.stringify(dependenciesMissingInBackstage)}`);

                                // Add missing dependencies to PagerDuty
                                if (dependenciesMissingInPagerDuty.length > 0) {
                                    await client.addServiceRelationToService(serviceId, dependenciesMissingInPagerDuty);
                                }

                                // Add missing dependencies to Backstage
                                entity.spec!.dependsOn = refreshServiceDependencyAnnotations(entity, mappings, dependencyIds, emit);

                                break;
                            default:
                                // Do nothing. Strategy not defined or set to disabled
                                break;
                        }
                    }
                }

            } catch (error) {
                this.logger.error(`Error processing entity ${entity.metadata.name}: ${error}`);
            }
        }

        return entity;
    }
}

export function refreshServiceDependencyAnnotations(entity: Entity, mappingsDic: Record<string, string>, dependencies: string[], emit: CatalogProcessorEmit): string[] {
    const dependencyList: string[] = [];
    dependencies.forEach((dependencyId) => {
        const foundEntityRef = mappingsDic[dependencyId];

        if (foundEntityRef && foundEntityRef !== "") {
            dependencyList.push(foundEntityRef);

            const entityRefParts = foundEntityRef.split(":");
            const kind = entityRefParts[0];
            const namespaceName = entityRefParts[1].split("/");
            const namespace = namespaceName[0];
            const name = namespaceName[1];

            emit(processingResult.relation({
                source: {
                    kind: entity.kind,
                    namespace: entity.metadata.namespace!,
                    name: entity.metadata.name,
                },
                target: {
                    kind: kind,
                    namespace: namespace,
                    name: name,
                },
                type: RELATION_DEPENDS_ON,
            }));
            
            emit(processingResult.relation({
                source: {
                    kind: kind,
                    namespace: namespace,
                    name: name,
                },
                target: {
                    kind: entity.kind,
                    namespace: entity.metadata.namespace!,
                    name: entity.metadata.name,
                },
                type: RELATION_DEPENDENCY_OF,
            }));
        }
    });

    return dependencyList;
}

export type AnnotationUpdateProps = {
    serviceId?: string;
    integrationKey?: string;
    account?: string;
};

function updateAnnotations(entity: Entity, annotations: AnnotationUpdateProps): void {
    // If serviceId is present, add the annotations to the entity
    if (annotations.serviceId && annotations.serviceId !== "") {
        entity.metadata.annotations!["pagerduty.com/service-id"] = annotations.serviceId;
    }
    else {
        delete entity.metadata.annotations!["pagerduty.com/service-id"];
    }

    // If integrationKey is present, add the annotations to the entity
    if (annotations.integrationKey && annotations.integrationKey !== "") {
        entity.metadata.annotations!["pagerduty.com/integration-key"] = annotations.integrationKey;
    }
    else {
        delete entity.metadata.annotations!["pagerduty.com/integration-key"];
    }

    // If account is present, add the annotations to the entity
    if (annotations.account && annotations.account !== "") {
        entity.metadata.annotations!["pagerduty.com/account"] = annotations.account;
    }
    else {
        delete entity.metadata.annotations!["pagerduty.com/account"];
    }
}

async function buildExistingDependencies(dependencyAnnotations: string[]): Promise<string[]> {
    const dependencies: string[] = [];

    // Get all service ids matching the dependency annotations
    if (dependencyAnnotations.length > 0) {
        await Promise.all(
            dependencyAnnotations.map(async (dependency) => {
                const foundServiceId = await client.getServiceIdAnnotationFromCatalog(dependency);

                if (foundServiceId !== "") {
                    dependencies.push(foundServiceId);
                }
            })
        );
    }

    return dependencies;

}