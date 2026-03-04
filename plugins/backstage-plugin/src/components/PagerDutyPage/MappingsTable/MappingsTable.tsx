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
  entity?: {
    name: string;
    entityRef: string;
    owner: string;
  };
}

export type AutoMatchResults = Record<string, AutoMatchResult>;

interface MappingsTableContentProps {
  autoMatchResults: AutoMatchResults;
  hasMatches: boolean;
  showFilters: boolean;
  filters: {
    name: string;
    serviceName: string;
    status: string;
    teamName: string;
  };
  onFilterChange: (
    key: 'name' | 'serviceName' | 'status' | 'teamName',
    value: string,
  ) => void;
  onEditEntity: (entity: BackstageEntity) => void;
  onRemoveMatch: (entityName: string) => void;
}

function MappingsTableContent({
  autoMatchResults,
  hasMatches,
  showFilters,
  filters,
  onFilterChange,
  onEditEntity,
  onRemoveMatch,
}: MappingsTableContentProps) {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const { selectedAccount } = useAccountContext();
  const debouncedFilters = useDebounce(filters);

  const { tableProps } = useTable<BackstageEntity, typeof filters>({
    mode: 'offset',
    filter: debouncedFilters,
    getData: async ({ offset, pageSize, sort, filter }) => {
      if (hasMatches) {
        let matchedEntities: BackstageEntity[] = Object.entries(
          autoMatchResults,
        ).map(([entityName, matchResult]) => {
          const entityRef = matchResult.entity?.entityRef || '';
          const refParts = entityRef.split(':');
          const type = refParts[0] || 'component';
          const namespaceName = refParts[1]?.split('/') || ['default', entityName];
          const namespace = namespaceName[0] || 'default';

          return {
            id: entityRef || `${type}:${namespace}/${entityName}`,
            name: entityName,
            namespace: namespace,
            type: type,
            system: '',
            owner: matchResult.entity?.owner || '',
            lifecycle: '',
            annotations: {
              'pagerduty.com/integration-key': '',
              'pagerduty.com/service-id': matchResult.serviceId,
            },
            serviceName: matchResult.serviceName,
            serviceUrl: `https://pagerduty.com/services/${matchResult.serviceId}`,
            team: matchResult.entity?.owner || '',
            escalationPolicy: '',
            status: 'AutoMapped' as const,
            account: matchResult.account,
            mappingScore: matchResult.score,
            autoMatchedServiceId: matchResult.serviceId,
            autoMatchedServiceName: matchResult.serviceName,
          } as BackstageEntity;
        });

        if (filter) {
          matchedEntities = matchedEntities.filter(entity => {
            if (filter.name && !entity.name.toLowerCase().includes(filter.name.toLowerCase())) {
              return false;
            }
            if (filter.serviceName && entity.serviceName && !entity.serviceName.toLowerCase().includes(filter.serviceName.toLowerCase())) {
              return false;
            }
            if (filter.status && entity.status !== filter.status) {
              return false;
            }
            if (filter.teamName && entity.owner && !entity.owner.toLowerCase().includes(filter.teamName.toLowerCase())) {
              return false;
            }
            return true;
          });
        }

        if (sort) {
          matchedEntities.sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sort.column) {
              case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
              case 'team':
                aValue = (a.owner || '').toLowerCase();
                bValue = (b.owner || '').toLowerCase();
                break;
              case 'serviceName':
                aValue = (a.serviceName || '').toLowerCase();
                bValue = (b.serviceName || '').toLowerCase();
                break;
              case 'status':
                aValue = (a.status || '').toLowerCase();
                bValue = (b.status || '').toLowerCase();
                break;
              case 'mappingScore':
                aValue = a.mappingScore ?? 0;
                bValue = b.mappingScore ?? 0;
                break;
              default:
                return 0;
            }

            if (aValue < bValue) {
              return sort.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
              return sort.direction === 'ascending' ? 1 : -1;
            }
            return 0;
          });
        }

        const start = offset;
        const end = offset + pageSize;
        const paginatedData = matchedEntities.slice(start, end);

        return {
          data: paginatedData,
          totalCount: matchedEntities.length,
        };
      }
      const response = await pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        filters: filter,
        sort: sort
          ? { column: String(sort.column), direction: sort.direction }
          : undefined,
        account: selectedAccount,
      });

      return {
        data: response.entities as BackstageEntity[],
        totalCount: response.totalCount,
      };
    },
    paginationOptions: {
      pageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
    },
  });

  const columnConfig: ColumnConfig<BackstageEntity>[] = useMemo(() => {
    const baseColumns: ColumnConfig<BackstageEntity>[] = [
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
    ];
    
    if (hasMatches) {
      baseColumns.push({
        id: 'mappingScore',
        label: 'Mapping Score',
        isRowHeader: true,
        isSortable: true,
        cell: entity => (
          <CellText
            title={
              entity.mappingScore !== undefined
                ? `${entity.mappingScore}%`
                : '—'
            }
          />
        ),
      });
    }

    baseColumns.push({
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
              onRemoveMatch(entity.name);
            } else {
              onEditEntity(entity);
            }
          }}
        />
      ),
    });

    return baseColumns;
  }, [hasMatches, onRemoveMatch, onEditEntity]);

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
      {showFilters && (
        <FilterRow filters={filters} onFilterChange={onFilterChange} />
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
    </>
  );
}

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
  const hasMatches = Object.keys(autoMatchResults).length > 0;
  const tableKey = `${selectedAccount}-${hasMatches ? `matches-${Object.keys(autoMatchResults).length}` : 'no-matches'}`;

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
