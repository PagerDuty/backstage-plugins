import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../../api';
import { AutoMatchResults } from '../MappingsTable';
import { MappingCounts } from '../MappingToast';
import { FormattedBackstageEntity } from '@pagerduty/backstage-plugin-common';

interface UseConfirmMappingsParams {
  autoMatchResults: AutoMatchResults;
  mappingEntities?: FormattedBackstageEntity[];
  onSuccess: (
    successCount: number,
    totalCount: number,
    counts: MappingCounts,
  ) => void;
  onError: (errorMessage: string) => void;
}

export function useConfirmMappings({
  autoMatchResults,
  mappingEntities,
  onSuccess,
  onError,
}: UseConfirmMappingsParams) {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  const confirmMappings = async () => {
    try {
      setIsConfirming(true);
      const totalCount = Object.keys(autoMatchResults).length;
      const mappingsToCreate = Object.entries(autoMatchResults).map(
        ([entityName, matchData]) => {
          const entity = mappingEntities?.find(
            (e: FormattedBackstageEntity) => e.name === entityName,
          );

          const entityRef = entity
            ? `${entity.type}:${entity.namespace}/${entity.name}`.toLowerCase()
            : `component:default/${entityName}`;

          return {
            serviceId: matchData.serviceId,
            integrationKey: '',
            entityRef: entityRef,
            account: matchData.account || '',
          };
        },
      );

      const response = await pagerDutyApi.storeBulkServiceMappings(
        mappingsToCreate,
      );

      if (response.ok) {
        const result = await response.json();
        const successCount = result.successCount || 0;
        const skippedCount = result.skippedCount || 0;
        const errorCount = result.errorCount || 0;

        const counts: MappingCounts = {
          created: successCount,
          skipped: skippedCount,
          errored: errorCount,
        };
        onSuccess(successCount, totalCount, counts);
        queryClient.invalidateQueries({
          queryKey: ['pagerduty', 'enhancedEntityMappings'],
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        onError(
          errorData.error || 'Failed to save mappings. Please try again.',
        );
      }
    } catch (error) {
      onError(
        `An error occurred while saving mappings: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return { confirmMappings, isConfirming };
}
