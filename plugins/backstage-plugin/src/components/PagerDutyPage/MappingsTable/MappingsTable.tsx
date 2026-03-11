import {
  Flex,
  ButtonIcon,
} from '@backstage/ui';
import { useState, useCallback } from 'react';
import MappingsDialog from '../MappingsDialog';
import AutomaticMappingsDialog from '../AutomaticMappingsDialog';
import AutoMappingsButton from './AutoMappingsButton';
import { FilterList, Refresh } from '@mui/icons-material';
import { BackstageEntity } from '../../types';
import MappingToast, { MappingCounts, ToastSeverity } from './MappingToast';
import { useConfirmMappings } from './hooks/useConfirmMappings';
import { useQueryClient } from '@tanstack/react-query';

import { FormattedBackstageEntity } from '@pagerduty/backstage-plugin-common';
import { useAccountContext } from '../AccountContext';
import MappingsTableContent from './MappingsTableContent';

export interface AutoMatchResult {
  score: number;
  serviceId: string;
  account: string;
  serviceName: string;
  entity?: {
    name: string;
    entityRef: string;
    owner: string;
  };
}

export type AutoMatchResults = Record<string, AutoMatchResult>;

export default function MappingsTable() {
  const queryClient = useQueryClient();
  const { selectedAccount } = useAccountContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMappingOpen, setIsAutoMappingOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BackstageEntity | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    name: '',
    serviceName: '',
    status: '',
    teamName: '',
  });

  const [toastOpen, setToastOpen] = useState(false);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');
  const [toastMessage, setToastMessage] = useState('');
  const [toastTotalMatches, setToastTotalMatches] = useState<number>(0);
  const [toastMappingCounts, setToastMappingCounts] = useState<MappingCounts>(
    {},
  );

  const [autoMatchResults, setAutoMatchResults] = useState<AutoMatchResults>(
    {},
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const hasMatches = Object.keys(autoMatchResults).length > 0;
  const tableKey = `${selectedAccount}-${hasMatches ? `matches-${Object.keys(autoMatchResults).length}` : 'no-matches'}-${refreshKey}`;

  const clearMatches = useCallback(() => {
    setAutoMatchResults({});
  }, []);

  const setMatches = (results: AutoMatchResults) => {
    setAutoMatchResults(results);
  };

  const removeMatch = useCallback((entityName: string) => {
    setAutoMatchResults(prev => {
      const updated = { ...prev };
      delete updated[entityName];
      return updated;
    });
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof typeof filters, value: string) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleEditEntity = useCallback((entity: BackstageEntity) => {
    setIsOpen(true);
    setSelectedEntity(entity);
  }, []);

  const handleMappingSuccess = useCallback((isUnmapping: boolean) => {
    setToastOpen(true);
    setToastSeverity('info');
    setToastMessage(
      `Mapping ${isUnmapping ? 'removed' : 'created'} successfully. The catalog sync runs approximately every 30 seconds. Please wait a bit and refresh the page to see the updated status.`
    );
    setToastTotalMatches(0);
    setToastMappingCounts({});
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    queryClient.invalidateQueries({
      queryKey: ['pagerduty', 'enhancedEntityMappings'],
    });
  }, [queryClient]);

  const { confirmMappings, isConfirming } = useConfirmMappings({
    autoMatchResults,
    mappingEntities: Object.values(autoMatchResults).map(match => ({
      name: match.entity?.name || '',
      id: match.entity?.entityRef || '',
      namespace: 'default',
      type: 'component',
      system: '',
      owner: match.entity?.owner || '',
      lifecycle: '',
      annotations: {
        'pagerduty.com/integration-key': '',
        'pagerduty.com/service-id': match.serviceId,
      },
    })) as FormattedBackstageEntity[],
    onSuccess: (successCount, totalCount, counts) => {
      queryClient.invalidateQueries({
        queryKey: ['pagerduty', 'enhancedEntityMappings'],
      });
      clearMatches();
      setToastOpen(true);
      setToastSeverity('success');
      setToastMessage(
        `${successCount} of ${totalCount} mappings saved successfully.`,
      );
      setToastTotalMatches(0);
      setToastMappingCounts(counts);
    },
    onError: errorMessage => {
      setToastOpen(true);
      setToastSeverity('error');
      setToastMessage(errorMessage);
      setToastTotalMatches(0);
      setToastMappingCounts({});
    },
  });

  return (
    <>
      <Flex justify="end" gap="2">
        <AutoMappingsButton
          hasMatches={hasMatches}
          onAutoMapping={() => setIsAutoMappingOpen(true)}
          onConfirmMappings={confirmMappings}
          onClearMappings={clearMatches}
          isConfirming={isConfirming}
        />

        <ButtonIcon
          icon={<Refresh />}
          aria-label="Refresh table"
          onClick={handleRefresh}
          variant="secondary"
        >
          <Refresh />
        </ButtonIcon>

        <ButtonIcon
          icon={<FilterList />}
          aria-label="Toggle filters"
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'primary' : 'secondary'}
        >
          <FilterList />
        </ButtonIcon>
      </Flex>

      <MappingsTableContent
        key={tableKey}
        autoMatchResults={autoMatchResults}
        hasMatches={hasMatches}
        showFilters={showFilters}
        filters={filters}
        onFilterChange={handleFilterChange}
        onEditEntity={handleEditEntity}
        onRemoveMatch={removeMatch}
      />

      <MappingsDialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        entity={selectedEntity}
        onMappingSuccess={handleMappingSuccess}
      />
      <AutomaticMappingsDialog
        isOpen={isAutoMappingOpen}
        setIsOpen={setIsAutoMappingOpen}
        onAutoMatchComplete={results => {
          setMatches(results);
          const matchCount = Object.keys(results).length;
          setToastOpen(true);
          setToastSeverity('success');
          setToastMessage(`${matchCount} services mapped successfully.`);
          setToastTotalMatches(matchCount);
          setToastMappingCounts({});
        }}
      />
      <MappingToast
        open={toastOpen}
        severity={toastSeverity}
        message={toastMessage}
        totalMatches={toastTotalMatches}
        mappingCounts={toastMappingCounts}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}
