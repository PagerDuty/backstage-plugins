import {
  Table,
  useTable,
  CellText,
  Flex,
  ButtonIcon,
  type ColumnConfig,
} from '@backstage/ui';
import { useState, useCallback, useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import MappingsDialog from '../MappingsDialog';
import AutomaticMappingsDialog from '../AutomaticMappingsDialog';
import AutoMappingsButton from './AutoMappingsButton';
import StatusCell from './StatusCell';
import { ServiceCell } from './ServiceCell';
import { Edit, Delete, FilterList } from '@mui/icons-material';
import { FilterRow } from './FilterRow';
import { TableSkeleton } from './TableSkeleton';
import { EmptyTableState } from './EmptyTableState';
import { BackstageEntity } from '../../types';
import useDebounce from '../../../hooks/useDebounce';
import MappingToast, { MappingCounts, ToastSeverity } from './MappingToast';
import { useConfirmMappings } from './hooks/useConfirmMappings';
import { useQueryClient } from '@tanstack/react-query';
import { pagerDutyApiRef } from '../../../api';
import { FormattedBackstageEntity } from '@pagerduty/backstage-plugin-common';
import { useAccountContext } from '../AccountContext';

export interface AutoMatchResult {
  score: number;
  serviceId: string;
  account: string;
  serviceName: string;
}

export type AutoMatchResults = Record<string, AutoMatchResult>;

export default function MappingsTable() {
  const pagerDutyApi = useApi(pagerDutyApiRef);
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

  const debouncedFilters = useDebounce(filters);

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
  const hasMatches = Object.keys(autoMatchResults).length > 0;

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

  const { tableProps } = useTable<BackstageEntity, typeof filters>({
    mode: 'offset',
    filter: debouncedFilters,
    getData: async ({ offset, pageSize, sort, filter }) => {
      const response = await pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        filters: filter,
        sort: sort
          ? { column: String(sort.column), direction: sort.direction }
          : undefined,
        account: selectedAccount,
      });

      const entitiesWithScores = response.entities.map(
        (entity: FormattedBackstageEntity): BackstageEntity => {
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
        data: entitiesWithScores,
        totalCount: response.totalCount,
      };
    },
    paginationOptions: {
      pageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
    },
  });

  const { confirmMappings, isConfirming } = useConfirmMappings({
    autoMatchResults,
    mappingEntities: tableProps.data as FormattedBackstageEntity[],
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

  const columnConfig: ColumnConfig<BackstageEntity>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        isRowHeader: true,
        isSortable: true,
        cell: entity => <CellText title={entity.name} />,
      },
      {
        id: 'team',
        label: 'Team',
        isRowHeader: true,
        isSortable: true,
        cell: entity => <CellText title={entity.owner} />,
      },
      {
        id: 'serviceName',
        label: 'PagerDuty service',
        isRowHeader: true,
        isSortable: true,
        cell: entity => <ServiceCell entity={entity} />,
      },
      {
        id: 'status',
        label: 'Status',
        isRowHeader: true,
        isSortable: true,
        cell: entity => <StatusCell entity={entity} />,
      },
      {
        id: 'mappingScore',
        label: 'Mapping Score',
        isRowHeader: true,
        isSortable: false,
        cell: entity => (
          <CellText
            title={
              entity.mappingScore !== undefined
                ? `${entity.mappingScore}%`
                : '—'
            }
          />
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        isRowHeader: true,
        isSortable: false,
        cell: entity => (
          <CellText
            leadingIcon={
              entity.mappingScore !== undefined ? (
                <Delete fontSize="small" />
              ) : (
                <Edit fontSize="small" />
              )
            }
            color="secondary"
            style={{
              paddingLeft: '25px',
              cursor: 'pointer',
              maxWidth: 'min-content',
            }}
            title=""
            onClick={() => {
              if (entity.mappingScore !== undefined) {
                removeMatch(entity.name);
              } else {
                setIsOpen(true);
                setSelectedEntity(entity);
              }
            }}
          />
        ),
      },
    ],
    [removeMatch, setIsOpen, setSelectedEntity],
  );

  const isInitialLoad =
    tableProps.loading && (!tableProps.data || tableProps.data.length === 0);

  const hasActiveFilters =
    showFilters &&
    (!!filters.name ||
      !!filters.serviceName ||
      !!filters.status ||
      !!filters.teamName);

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
          icon={<FilterList />}
          aria-label="Toggle filters"
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'primary' : 'secondary'}
        >
          <FilterList />
        </ButtonIcon>
      </Flex>

      {showFilters && (
        <FilterRow filters={filters} onFilterChange={handleFilterChange} />
      )}

      {isInitialLoad ? (
        <TableSkeleton />
      ) : (
        <Table
          columnConfig={columnConfig}
          {...tableProps}
          emptyState={<EmptyTableState hasActiveFilters={hasActiveFilters} />}
        />
      )}

      <MappingsDialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        entity={selectedEntity}
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
