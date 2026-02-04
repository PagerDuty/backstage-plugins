import { useQuery } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../../api';
import { BackstageEntity } from '../../../types';
import { AutoMatchResults } from './useAutoMatchResults';

export function useEntityMappings(
  offset: number,
  pageSize: number,
  searchQuery: string,
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
        search: searchQuery,
      },
    ],
    queryFn: () =>
      pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        search: searchQuery,
        searchFields: ['metadata.name', 'spec.owner'],
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
