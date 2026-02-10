import { useQuery } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../../api';
import { BackstageEntity } from '../../../types';
import { AutoMatchResults } from '../MappingsTable';

export function useEntityMappings(
  offset: number,
  pageSize: number,
  filters: { name: string; serviceName: string; status: string; teamName: string; account: string },
  autoMatchResults: AutoMatchResults,
) {
  const pagerDutyApi = useApi(pagerDutyApiRef);

  const { data: mappings, isLoading } = useQuery({
    queryKey: [
      'pagerduty',
      'enhancedEntityMappings',
      {
        offset,
        pageSize,
        filters,
      },
    ],
    queryFn: () =>
      pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        searchFields: ['metadata.name', 'spec.owner'],
        filters,
      }),
  });

  // Merge auto-match results with entities
  const entitiesWithScores = mappings?.entities.map(
    (entity: BackstageEntity) => {
      const matchResult = autoMatchResults[entity.name];

      if (matchResult) {
        return {
          ...entity,
          mappingScore: matchResult.score,
          status: 'AutoMapped' as const,
          serviceName: matchResult.serviceName,
          autoMatchedServiceId: matchResult.serviceId,
          autoMatchedServiceName: matchResult.serviceName,
        };
      }

      return entity;
    },
  );

  return {
    mappings,
    entitiesWithScores,
    isLoading,
  };
}
