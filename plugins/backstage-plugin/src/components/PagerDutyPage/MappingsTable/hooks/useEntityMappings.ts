import { useQuery } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../../api';
import { AutoMatchResults } from '../MappingsTable';
import { FormattedBackstageEntity } from '@pagerduty/backstage-plugin-common';
import { BackstageEntity } from '../../../types';

export function useEntityMappings(
  offset: number,
  pageSize: number,
  filters: { name: string; serviceName: string; status: string; teamName: string; account: string },
  sort: { column: string; direction: 'ascending' | 'descending' } | undefined,
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
        sort,
      },
    ],
    queryFn: () =>
      pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        filters,
        sort,
      }),
  });

  // Merge auto-match results with entities
  const entitiesWithScores = mappings?.entities.map((entity: FormattedBackstageEntity): BackstageEntity => {
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

      return entity as BackstageEntity;
    },
  );

  return {
    mappings,
    entitiesWithScores,
    isLoading,
  };
}
