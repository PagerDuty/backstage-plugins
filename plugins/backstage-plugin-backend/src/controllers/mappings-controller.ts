import { Request, Response } from 'express';
import * as Pagerduty from '../services/pagerduty';
import * as CatalogEntityUtils from '../utils/catalog-entity';
import { PagerDutyBackendStore } from '../db';
import { CatalogApi, GetEntitiesResponse, QueryEntitiesResponse } from '@backstage/catalog-client';
import { HttpError, PagerDutyEntityMappingsResponse, PagerDutyService, FormattedBackstageEntity } from '@pagerduty/backstage-plugin-common';
import { getServiceByIntegrationKey, getServicesByIds } from '../apis/pagerduty';
import { RawDbEntityResultRow } from '../db/PagerDutyBackendDatabase';

// Status order for sorting (from least to most complete)
const STATUS_ORDER: Record<NonNullable<FormattedBackstageEntity['status']>, number> = {
  'ErrorWhenFetchingService': 0,
  'NotMapped': 1,
  'OutOfSync': 2,
  'InSync': 3,
};

// Maximum number of entities to fetch when post-processing filters are needed
const MAX_ENTITIES_FOR_POST_PROCESSING = 10000;

function compareEntities(
  a: FormattedBackstageEntity,
  b: FormattedBackstageEntity,
  column: string,
  direction: 'ascending' | 'descending',
): number {
  let comparison = 0;

  const fieldMap: Record<string, keyof FormattedBackstageEntity> = {
    name: 'name',
    team: 'owner',
    serviceName: 'serviceName',
    status: 'status',
    account: 'account',
  };

  const field = fieldMap[column];

  if (field === 'status') {
    const aStatus = (a.status || 'NotMapped') as NonNullable<FormattedBackstageEntity['status']>;
    const bStatus = (b.status || 'NotMapped') as NonNullable<FormattedBackstageEntity['status']>;
    const aOrder = STATUS_ORDER[aStatus];
    const bOrder = STATUS_ORDER[bStatus];
    comparison = aOrder - bOrder;
  } else {
    const aValue = ((a[field] || '') as string).toLowerCase();
    const bValue = ((b[field] || '') as string).toLowerCase();

    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }
  }

  return direction === 'ascending' ? comparison : -comparison;
}

export function getMappingEntities(store: PagerDutyBackendStore, catalogApi: CatalogApi) {
  return async function getMappingEntitiesFunction(request: Request, response: Response) {
    try {
      const { offset = 0, limit = 10, filters = {}, sort } = request.body;

      if (typeof offset !== 'number' || typeof limit !== 'number' || offset < 0 || limit <= 0) {
        response
          .status(400)
          .json({ errors: ["Bad Request: 'offset' and 'limit' must be valid numbers"] });

        return;
      }

      const validSortColumns = ['name', 'team', 'serviceName', 'status', 'account'];
      const validSortDirections = ['ascending', 'descending'];

      if (sort !== undefined) {
        if (typeof sort !== 'object' || sort === null) {
          response
            .status(400)
            .json({ errors: ["Bad Request: 'sort' must be an object"] });
          return;
        }

        if (typeof sort.column !== 'string' || !validSortColumns.includes(sort.column)) {
          response
            .status(400)
            .json({ errors: [`Bad Request: 'sort.column' must be one of: ${validSortColumns.join(', ')}`] });
          return;
        }

        if (typeof sort.direction !== 'string' || !validSortDirections.includes(sort.direction)) {
          response
            .status(400)
            .json({ errors: [`Bad Request: 'sort.direction' must be one of: ${validSortDirections.join(', ')}`] });
          return;
        }
      }

      const hasStatusFilter = filters?.status?.trim();
      const hasNameFilter = filters?.name?.trim();
      const hasTeamNameFilter = filters?.teamName?.trim();
      const hasAccountFilter = filters?.account?.trim();
      const needsBothFullTextFilters = hasNameFilter && hasTeamNameFilter;
      const needsSortPostProcessing = !!sort;

      const needsPostProcessing = hasStatusFilter || needsBothFullTextFilters || hasAccountFilter || needsSortPostProcessing;

      const queryOptions: {
        filter: Array<{
          kind: string;
          'metadata.namespace'?: string;
          'metadata.name'?: string;
        }>;
        limit: number;
        offset: number;
        fullTextFilter?: { term: string; fields: string[] };
      } = {
        filter: [{ kind: 'Component' }],
        limit: needsPostProcessing ? MAX_ENTITIES_FOR_POST_PROCESSING : limit,
        offset: needsPostProcessing ? 0 : offset,
      };

      const allEntityMappings = await store.getAllEntityMappings();

      if (filters?.serviceName?.trim()) {
        const serviceQuery = filters.serviceName.trim();

        const matchingPagerDutyServiceIds = await Pagerduty.getServicesIdsByPartialName(serviceQuery);

        if (matchingPagerDutyServiceIds.length > 0) {        
          const mappingsWithMatchingPagerdutyServices = allEntityMappings.filter(
            mapping => matchingPagerDutyServiceIds.includes(mapping.serviceId),
          );

          const entityRefs: Array<string> =
            mappingsWithMatchingPagerdutyServices
              .map(mapping => mapping.entityRef)
              .filter(Boolean);

          if (entityRefs.length > 0) {
            // extract shape of { kind: 'Component', 'metadata.namespace': string, 'metadata.name': string }
            queryOptions.filter = entityRefs.map(_extractQueryFilterFromEntityRef).filter(f => f !== null);

            if (queryOptions.filter.length === 0) {
              response.json({ entities: [], totalCount: 0 });
              return;
            }
          } else {
            response.json({ entities: [], totalCount: 0 });
            return;
          }
        } else {
          response.json({ entities: [], totalCount: 0 });
          return;
        }
      }

      const componentEntities = await _queryEntitiesWithFilters(
        catalogApi,
        queryOptions,
        filters.name,
        filters.teamName,
      );
 
      const currentPageMappings = allEntityMappings.filter(mapping => {
        return componentEntities.items.some(entity => {
          const entityRef = CatalogEntityUtils.entityRef(entity).toLowerCase();

          const integrationKey = CatalogEntityUtils.getPagerDutyIntegrationKey(entity);

          return (mapping.entityRef === entityRef || mapping.integrationKey === integrationKey);
        });
      });

      const currentPagePagerDutyServiceIds = currentPageMappings.map(mapping => mapping.serviceId).filter(Boolean);

      const currentPagePagerDutyServices = await getServicesByIds(currentPagePagerDutyServiceIds);

      const componentEntitiesDict =
        await CatalogEntityUtils.createComponentEntitiesReferenceDict(componentEntities);

      const maps = await _buildEntityMappingsResponse(
        allEntityMappings,
        componentEntitiesDict,
        componentEntities,
        currentPagePagerDutyServices,
      );

      let formattedEntities: Array<FormattedBackstageEntity> = await Promise.all(
        componentEntities.items.map(async entity => {
          const annotations = {
            'pagerduty.com/integration-key': CatalogEntityUtils.getPagerDutyIntegrationKey(entity) ?? '',
            'pagerduty.com/service-id': CatalogEntityUtils.getPagerDutyServiceId(entity) ?? '',
          };

          const formattedEntity = {
            name: entity.metadata?.name,
            id: entity.metadata?.uid ?? '',
            namespace: entity.metadata?.namespace ?? '',
            type: entity.kind ?? '',
            system: entity.spec?.system ? JSON.stringify(entity.spec?.system) : '',
            owner: entity.spec?.owner ? JSON.stringify(entity.spec?.owner) : '',
            lifecycle: entity.spec?.lifecycle ? JSON.stringify(entity.spec?.lifecycle) : '',
            annotations,
            status: 'NotMapped' as NonNullable<FormattedBackstageEntity['status']>,
            serviceName: '',
            serviceUrl: '',
            team: '',
            escalationPolicy: '',
            account: '',
          };

          // Try to find a service by service ID or integration key
          let service = null;
          let isServiceError = null;

          if (annotations['pagerduty.com/service-id']) {
            const serviceId = annotations['pagerduty.com/service-id'];
            service = currentPagePagerDutyServices.find(s => s.id === serviceId);
          } else if (annotations['pagerduty.com/integration-key']) {
            const integrationKey = annotations['pagerduty.com/integration-key'];
            const account = entity.metadata?.annotations?.['pagerduty.com/account'] || '';

            try {
              service = await getServiceByIntegrationKey(integrationKey, account);
            } catch (e) {
              if (e instanceof HttpError && e.status !== 404) {
                isServiceError = true;
              }
            }
          }

          const entityRef = CatalogEntityUtils.entityRef(entity).toLowerCase();

          const entityMapping = maps.mappings.find(
            mapping =>
              mapping.entityRef === entityRef ||
              (mapping.integrationKey && mapping.integrationKey ===  annotations['pagerduty.com/integration-key']) ||
              (mapping.serviceId && mapping.serviceId === annotations['pagerduty.com/service-id']),
          );

          if (service) {
            formattedEntity.serviceName = service.name;
            formattedEntity.serviceUrl = service.html_url;
            formattedEntity.team = service.teams?.[0]?.name ?? '';
            formattedEntity.escalationPolicy = service.escalation_policy?.name ?? '';
            formattedEntity.account = service.account || '';

            if (entityMapping) {
              const expectedEntityRef = componentEntitiesDict[service.id]?.ref;

              if (expectedEntityRef && expectedEntityRef === entityMapping.entityRef) {
                formattedEntity.status = 
                  (entityMapping.status || 'NotMapped') as NonNullable<FormattedBackstageEntity['status']>;
              } else {
                formattedEntity.status = 'NotMapped' as NonNullable<FormattedBackstageEntity['status']>;
              }
            }
          } else if (isServiceError) {
            formattedEntity.status = 'ErrorWhenFetchingService';
          }

          return formattedEntity;
        }),
      );

      if (hasStatusFilter) {
        formattedEntities = formattedEntities.filter(entity => entity.status === filters.status.trim());
      }

      if (hasAccountFilter) {
        formattedEntities = formattedEntities.filter(entity =>
          entity.account?.toLowerCase().includes(filters.account.trim().toLowerCase())
        );
      }

      if (sort) {
        formattedEntities.sort((a, b) => compareEntities(a, b, sort.column, sort.direction));
      }

      const totalCount = needsPostProcessing ? formattedEntities.length : componentEntities.totalItems;

      const paginatedEntities = needsPostProcessing
        ? formattedEntities.slice(offset, offset + limit)
        : formattedEntities;

      response.json({
        entities: paginatedEntities,
        totalCount,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.status).json({
          errors: [`${error.message}`],
        });
      }
    }
  };
}

function _extractQueryFilterFromEntityRef(entityRef: string) {
  const [, namespaceAndName] = entityRef.split(':');

  if (!namespaceAndName) {
    return null;
  }

  const [namespace, name] = namespaceAndName.split('/');

  return {
    kind: 'Component',
    'metadata.namespace': namespace,
    'metadata.name': name,
  };
}

async function _queryEntitiesWithFilters(
  catalog: CatalogApi,
  baseQueryOptions: {
    filter: Array<{
      kind: string;
      'metadata.namespace'?: string;
      'metadata.name'?: string;
    }>;
    limit: number;
    offset: number;
  },
  nameFilter?: string,
  teamNameFilter?: string,
): Promise<QueryEntitiesResponse> {
  const hasNameFilter = nameFilter?.trim();
  const hasTeamNameFilter = teamNameFilter?.trim();

  if (hasNameFilter && hasTeamNameFilter) {
    const [nameResults, teamResults] = await Promise.all([
      catalog.queryEntities({
        ...baseQueryOptions,
        fullTextFilter: {
          term: hasNameFilter,
          fields: ['metadata.name'],
        },
      }),
      catalog.queryEntities({
        ...baseQueryOptions,
        fullTextFilter: {
          term: hasTeamNameFilter,
          fields: ['spec.owner'],
        },
      }),
    ]);

    const nameResultUids = new Set(nameResults.items.map(entity => entity.metadata?.uid).filter(Boolean));

    const intersectedEntities = teamResults.items.filter(entity => nameResultUids.has(entity.metadata?.uid));

    return {
      items: intersectedEntities,
      totalItems: intersectedEntities.length,
      pageInfo: teamResults.pageInfo,
    };
  }

  const queryOptions: {
    filter: Array<{
      kind: string;
      'metadata.namespace'?: string;
      'metadata.name'?: string;
    }>;
    limit: number;
    offset: number;
    fullTextFilter?: { term: string; fields: string[] };
  } = { ...baseQueryOptions };

  if (hasNameFilter) {
    queryOptions.fullTextFilter = {
      term: hasNameFilter,
      fields: ['metadata.name'],
    };
  } else if (hasTeamNameFilter) {
    queryOptions.fullTextFilter = {
      term: hasTeamNameFilter,
      fields: ['spec.owner'],
    };
  }

  return catalog.queryEntities(queryOptions);
}

async function _buildEntityMappingsResponse(
  entityMappings: RawDbEntityResultRow[],
  componentEntitiesDict: Record<string, { ref: string; name: string; }>,
  componentEntities: GetEntitiesResponse,
  pagerDutyServices: PagerDutyService[],
): Promise<PagerDutyEntityMappingsResponse> {
  const result: PagerDutyEntityMappingsResponse = {
    mappings: [],
  };

  pagerDutyServices.forEach(service => {
    const entityRef = componentEntitiesDict[service.id]?.ref;
    const entityName = componentEntitiesDict[service.id]?.name;

    const entityMapping = entityMappings.find(mapping => mapping.serviceId === service.id);

    if (entityMapping) {
      if (entityRef === undefined) {
        if (entityMapping.entityRef === '' ||entityMapping.entityRef === undefined) {
          result.mappings.push({
            entityRef: '',
            entityName: '',
            integrationKey: entityMapping.integrationKey,
            serviceId: entityMapping.serviceId,
            status: 'NotMapped',
            serviceName: service.name,
            team: service.teams?.[0]?.name ?? '',
            escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
            serviceUrl: service.html_url,
            account: service.account,
          });
        } else {
          const entityRefName =
            componentEntities.items.find(
              entity =>
                `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() ===
                entityMapping.entityRef,
            )?.metadata.name ?? '';

          result.mappings.push({
            entityRef: entityMapping.entityRef,
            entityName: entityRefName,
            serviceId: entityMapping.serviceId,
            integrationKey: entityMapping.integrationKey,
            status: 'OutOfSync',
            serviceName: service.name,
            team: service.teams?.[0]?.name ?? '',
            escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
            serviceUrl: service.html_url,
            account: service.account,
          });
        }
      } else if (entityRef !== entityMapping.entityRef) {
        const entityRefName =
          componentEntities.items.find(
            entity =>
              `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() ===
              entityMapping.entityRef,
          )?.metadata.name ?? '';

        result.mappings.push({
          entityRef: entityMapping.entityRef !== '' ? entityMapping.entityRef : '',
          entityName: entityMapping.entityRef !== '' ? entityRefName : '',
          serviceId: entityMapping.serviceId,
          integrationKey: entityMapping.integrationKey,
          status: 'OutOfSync',
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? '',
          escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
          serviceUrl: service.html_url,
          account: service.account,
        });
      } else if (entityRef === entityMapping.entityRef) {
        result.mappings.push({
          entityRef: entityMapping.entityRef !== '' ? entityMapping.entityRef : '',
          entityName: entityMapping.entityRef !== '' ? entityName : '',
          serviceId: entityMapping.serviceId,
          integrationKey: entityMapping.integrationKey,
          status: 'InSync',
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? '',
          escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
          serviceUrl: service.html_url,
          account: service.account,
        });
      }
    } else {
      const backstageVendorId = 'PRO19CT';
      const backstageIntegrationKey =
        service.integrations?.find(
          integration => integration.vendor?.id === backstageVendorId,
        )?.integration_key ?? '';

      if (entityRef !== undefined) {
        result.mappings.push({
          entityRef: entityRef,
          entityName: entityName,
          serviceId: service.id,
          integrationKey: backstageIntegrationKey,
          status: 'InSync',
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? '',
          escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
          serviceUrl: service.html_url,
          account: service.account,
        });
      } else {
        result.mappings.push({
          entityRef: '',
          entityName: '',
          serviceId: service.id,
          integrationKey: backstageIntegrationKey,
          status: 'NotMapped',
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? '',
          escalationPolicy: service.escalation_policy !== undefined ? service.escalation_policy.name : '',
          serviceUrl: service.html_url,
          account: service.account,
        });
      }
    }
  });

  const sortedResult = result.mappings.sort((a, b) => {
    if (a.serviceName! < b.serviceName!) {
      return -1;
    } else if (a.serviceName! > b.serviceName!) {
      return 1;
    }
    return 0;
  });

  result.mappings = sortedResult;

  return result;
}
