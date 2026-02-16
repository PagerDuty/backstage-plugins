import { Row, Cell, SearchField, Select } from '@backstage/ui';

type FilterableFields = 'name' | 'serviceName' | 'status' | 'teamName' | 'account';

interface FilterRowProps {
  filters: {
    name: string;
    serviceName: string;
    status: string;
    teamName: string;
    account: string;
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

export function FilterRow({ filters, onFilterChange }: FilterRowProps) {
  return (
    <Row>
      <Cell>
        <SearchField
          size="small"
          placeholder="Filter by name"
          value={filters.name}
          onChange={value => onFilterChange('name', value)}
        />
      </Cell>

      <Cell>
        <SearchField
          size="small"
          placeholder="Filter by team"
          value={filters.teamName}
          onChange={value => onFilterChange('teamName', value)}
        />
      </Cell>
      
      <Cell>
        <SearchField
          size="small"
          placeholder="Filter by service"
          value={filters.serviceName}
          onChange={value => onFilterChange('serviceName', value)}
        />
      </Cell>
      
      <Cell>
        <Select
          selectionMode="single"
          size="small"
          value={filters.status}
          onChange={value => onFilterChange('status', value?.toString() || '')}
          placeholder="All statuses"
          options={statusOptions}
        />
      </Cell>

      <Cell>
        <SearchField
          size="small"
          placeholder="Filter by account"
          value={filters.account}
          onChange={value => onFilterChange('account', value)}
        />
      </Cell>
      <Cell>
        <div />
      </Cell>
      <Cell>
        <div />
      </Cell>
    </Row>
  );
}
