import { DiscoveryService, LoggerService } from "@backstage/backend-plugin-api";
import { Entity } from "@backstage/catalog-model";
import { CatalogProcessor, CatalogProcessorEmit } from "@backstage/plugin-catalog-node";
import { LocationSpec } from "@backstage/plugin-catalog-common";
/**
 * A function which given an entity, determines if it should be processed for linguist tags.
 * @public
 */
export type ShouldProcessEntity = (entity: Entity) => boolean;
export interface PagerDutyEntityProcessorOptions {
    logger: LoggerService;
    discovery: DiscoveryService;
}
export declare class PagerDutyEntityProcessor implements CatalogProcessor {
    private logger;
    private discovery;
    private shouldProcessEntity;
    constructor({ logger, discovery }: PagerDutyEntityProcessorOptions);
    getProcessorName(): string;
    preProcessEntity(entity: Entity): Promise<Entity>;
    postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}
export declare function refreshServiceDependencyAnnotations(entity: Entity, mappingsDic: Record<string, string>, dependencies: string[], emit: CatalogProcessorEmit): string[];
export type AnnotationUpdateProps = {
    serviceId?: string;
    integrationKey?: string;
    account?: string;
};
