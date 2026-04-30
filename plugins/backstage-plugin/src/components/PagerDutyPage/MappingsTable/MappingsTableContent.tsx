import {
  Table,
  useTable,
  CellText,
  type ColumnConfig,
} from '@backstage/ui';
import {  useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import StatusCell from './StatusCell';
import { ServiceCell } from './ServiceCell';
import { Edit, Delete } from '@mui/icons-material';
import { FilterRow } from './FilterRow';
import { TableSkeleton } from './TableSkeleton';
import { EmptyTableState } from './EmptyTableState';
import { BackstageEntity } from '../../types';
import useDebounce from '../../../hooks/useDebounce';
import { pagerDutyApiRef } from '../../../api';
import { AutoMatchResults } from './MappingsTable';
import { useAccountContext } from '../AccountContext';

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


export default function MappingsTableContent({
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