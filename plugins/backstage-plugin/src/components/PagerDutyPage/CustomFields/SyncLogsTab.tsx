import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CellText,
  Flex,
  Table,
  Text,
  useTable,
  type ColumnConfig,
} from '@backstage/ui';
import { Typography, makeStyles } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../api';
import {
  CustomFieldSyncLog,
  CustomFieldSyncLogFilters,
} from '@pagerduty/backstage-plugin-common';
import { TableSkeleton } from '../MappingsTable/TableSkeleton';
import { useAccountContext } from '../AccountContext';
import {
  SyncLogsFilters,
  SyncLogsFilterValues,
  EMPTY_SYNC_LOG_FILTERS,
} from './SyncLogsFilters';

const useStyles = makeStyles(() => ({
  severityBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 400,
    border: '1px solid',
  },
  severityWarning: {
    backgroundColor: '#fff1e1',
    borderColor: '#e08824',
    color: '#bb6b10',
  },
  severityError: {
    backgroundColor: '#fde8e8',
    borderColor: '#d92626',
    color: '#a01b1b',
  },
}));

type Severity = 'warning' | 'error';

const ERROR_CODES_ERROR: ReadonlySet<string> = new Set([
  'PD_API_ERROR',
  'INVALID_PATH',
]);

const getSeverity = (errorCode: string): Severity => {
  if (ERROR_CODES_ERROR.has(errorCode) || errorCode.toLowerCase().includes('error')) {
    return 'error';
  }
  return 'warning';
};

const formatTimestamp = (timestamp: Date) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const downloadCsv = (logs: CustomFieldSyncLog[]) => {
  const header = ['Timestamp', 'Severity', 'Custom Field', 'Entity Path', 'Service', 'Message'];
  const rows = logs.map(l => [
    new Date(l.timestamp).toISOString(),
    getSeverity(l.errorCode),
    l.customFieldName,
    l.entityPath,
    l.serviceName,
    l.errorMessage,
  ]);
  const csv = [header, ...rows]
    .map(row => row.map(cell => escapeCsv(String(cell))).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sync-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const classes = useStyles();
  const label = severity === 'error' ? 'Error' : 'Warning';
  const className = `${classes.severityBadge} ${
    severity === 'error' ? classes.severityError : classes.severityWarning
  }`;
  return (
    <Typography component="span" className={className}>
      {label}
    </Typography>
  );
};

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 10000;

const filtersToApi = (values: SyncLogsFilterValues): CustomFieldSyncLogFilters => {
  const result: CustomFieldSyncLogFilters = {};
  if (values.search.trim()) result.search = values.search.trim();
  if (values.severity === 'error' || values.severity === 'warning') {
    result.severity = values.severity;
  }
  if (values.customField) result.customFieldName = values.customField;
  if (values.entityPath) result.entityPath = values.entityPath;
  if (values.service) result.serviceName = values.service;
  return result;
};

const toOption = (v: string) => ({ value: v, label: v });

/** @public */
export const SyncLogsTab = () => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const { selectedAccount } = useAccountContext();
  const account = selectedAccount || undefined;

  const [filters, setFilters] = useState<SyncLogsFilterValues>(EMPTY_SYNC_LOG_FILTERS);

  const apiFilters = useMemo(() => filtersToApi(filters), [filters]);
  const apiFiltersRef = useRef(apiFilters);
  apiFiltersRef.current = apiFilters;

  const { data: optionsData } = useQuery({
    queryKey: ['pagerduty', 'syncLogs', 'filterOptions', account ?? ''],
    queryFn: () => pagerDutyApi.getSyncLogs(account),
  });

  const customFieldOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...(optionsData?.customFieldNames ?? []).map(toOption),
    ],
    [optionsData],
  );
  const entityPathOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...(optionsData?.entityPaths ?? []).map(toOption),
    ],
    [optionsData],
  );
  const serviceOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...(optionsData?.serviceNames ?? []).map(toOption),
    ],
    [optionsData],
  );

  const { tableProps } = useTable<CustomFieldSyncLog>({
    mode: 'offset',
    getData: async ({ offset, pageSize }) => {
      const result = await pagerDutyApi.getSyncLogs(account, {
        limit: pageSize,
        offset,
        ...apiFiltersRef.current,
      });
      return {
        data: result.logs,
        totalCount: result.total,
      };
    },
    paginationOptions: { pageSize: PAGE_SIZE, pageSizeOptions: [20, 50, 100] },
  });

  const columnConfig: ColumnConfig<CustomFieldSyncLog>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        label: 'Timestamp',
        isRowHeader: true,
        isSortable: false,
        cell: item => <CellText title={formatTimestamp(item.timestamp)} />,
      },
      {
        id: 'severity',
        label: 'Severity',
        isRowHeader: false,
        isSortable: false,
        cell: item => (
          <CellText
            title=""
            leadingIcon={<SeverityBadge severity={getSeverity(item.errorCode)} />}
          />
        ),
      },
      {
        id: 'customField',
        label: 'Custom Field',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.customFieldName} />,
      },
      {
        id: 'entityPath',
        label: 'Entity Path',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.entityPath} />,
      },
      {
        id: 'service',
        label: 'Service',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.serviceName} />,
      },
      {
        id: 'message',
        label: 'Message',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.errorMessage} />,
      },
    ],
    [],
  );

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await pagerDutyApi.getSyncLogs(account, {
        limit: EXPORT_LIMIT,
        offset: 0,
        ...apiFilters,
      });
      if (result.logs.length > 0) {
        downloadCsv(result.logs);
      }
    } finally {
      setExporting(false);
    }
  };

  if (tableProps.loading && !tableProps.data) {
    return <TableSkeleton />;
  }

  return (
    <Flex direction="column" gap="3">
      <SyncLogsFilters
        values={filters}
        onChange={setFilters}
        customFieldOptions={customFieldOptions}
        entityPathOptions={entityPathOptions}
        serviceOptions={serviceOptions}
        onExport={handleExport}
        exportDisabled={exporting || tableProps.data?.length === 0}
      />

      <Table
        columnConfig={columnConfig}
        {...tableProps}
        emptyState={
          <Text color="secondary">No sync log entries found</Text>
        }
      />
    </Flex>
  );
};
