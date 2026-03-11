import { Flex, SearchField, Select } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';

type FilterableFields =
  | 'name'
  | 'serviceName'
  | 'status'
  | 'teamName';

interface FilterRowProps {
  filters: {
    name: string;
    serviceName: string;
    status: string;
    teamName: string;
  };
  onFilterChange: (key: FilterableFields, value: string) => void;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'InSync', label: 'In Sync' },
  { value: 'OutOfSync', label: 'Out of Sync' },
  { value: 'NotMapped', label: 'Not Mapped' },
  { value: 'ErrorWhenFetchingService', label: 'Error' },
];

const useStyles = makeStyles(() => ({
  filterRow: {
    padding: '16px 0',
    marginBottom: '16px',
  },
  searchField: {},
}));

export function FilterRow({ filters, onFilterChange }: FilterRowProps) {
  const classes = useStyles();
  return (
    <Flex gap="3" align="center" className={classes.filterRow}>
      <SearchField
        size="small"
        placeholder="Filter by name"
        value={filters.name}
        onChange={value => onFilterChange('name', value)}
        className={classes.searchField}
      />

      <SearchField
        size="small"
        placeholder="Filter by team"
        value={filters.teamName}
        onChange={value => onFilterChange('teamName', value)}
        className={classes.searchField}
      />

      <SearchField
        size="small"
        placeholder="Filter by service"
        value={filters.serviceName}
        onChange={value => onFilterChange('serviceName', value)}
        className={classes.searchField}
      />

      <Select
        selectionMode="single"
        size="small"
        value={filters.status}
        onChange={value => onFilterChange('status', value?.toString() || '')}
        placeholder="All statuses"
        options={statusOptions}
      />
    </Flex>
  );
}
