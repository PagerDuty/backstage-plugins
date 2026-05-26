import { Box, Button, Flex, SearchField, Select, type Option } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { FileDownload } from '@mui/icons-material';

const useStyles = makeStyles(() => ({
  wrap: {
    flexWrap: 'wrap',
  },
}));

/** @public */
export type SyncLogsFilterValues = {
  search: string;
  severity: string;
  customField: string;
  entityPath: string;
  service: string;
};

/** @public */
export const EMPTY_SYNC_LOG_FILTERS: SyncLogsFilterValues = {
  search: '',
  severity: '',
  customField: '',
  entityPath: '',
  service: '',
};

interface SyncLogsFiltersProps {
  values: SyncLogsFilterValues;
  onChange: (next: SyncLogsFilterValues) => void;
  customFieldOptions: Option[];
  entityPathOptions: Option[];
  serviceOptions: Option[];
  onExport: () => void;
  exportDisabled?: boolean;
}

const SEVERITY_OPTIONS: Option[] = [
  { value: '', label: 'All' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

/** @public */
export const SyncLogsFilters = ({
  values,
  onChange,
  customFieldOptions,
  entityPathOptions,
  serviceOptions,
  onExport,
  exportDisabled,
}: SyncLogsFiltersProps) => {
  const classes = useStyles();
  const update = <K extends keyof SyncLogsFilterValues>(
    key: K,
    value: SyncLogsFilterValues[K],
  ) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <Flex align="end" justify="between" gap="3" className={classes.wrap}>
      <Flex align="end" gap="3" className={classes.wrap}>
        <Box width="200px">
          <SearchField
            label="Search"
            size="small"
            placeholder="Search..."
            value={values.search}
            onChange={value => update('search', value)}
          />
        </Box>
        <Box width="150px">
          <Select
            label="Severity"
            selectionMode="single"
            size="small"
            value={values.severity}
            onChange={value => update('severity', value?.toString() ?? '')}
            placeholder="All"
            options={SEVERITY_OPTIONS}
          />
        </Box>
        <Box width="160px">
          <Select
            label="Custom Field"
            selectionMode="single"
            size="small"
            value={values.customField}
            onChange={value => update('customField', value?.toString() ?? '')}
            placeholder="All"
            options={customFieldOptions}
          />
        </Box>
        <Box width="160px">
          <Select
            label="Entity Path"
            selectionMode="single"
            size="small"
            value={values.entityPath}
            onChange={value => update('entityPath', value?.toString() ?? '')}
            placeholder="All"
            options={entityPathOptions}
          />
        </Box>
        <Box width="160px">
          <Select
            label="Service"
            selectionMode="single"
            size="small"
            value={values.service}
            onChange={value => update('service', value?.toString() ?? '')}
            placeholder="All"
            options={serviceOptions}
          />
        </Box>
      </Flex>
      <Button
        variant="secondary"
        size="small"
        iconStart={<FileDownload fontSize="small" />}
        onClick={onExport}
        isDisabled={exportDisabled}
      >
        Export CSV
      </Button>
    </Flex>
  );
};
