import {
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TablePagination,
  CellText,
  Flex,
  ButtonIcon,
  SearchField,
} from '@backstage/ui';
import { useState, useCallback } from 'react';
import MappingsDialog from '../MappingsDialog';
import AutomaticMappingsDialog from '../AutomaticMappingsDialog';
import AutoMappingsButton from './AutoMappingsButton';
import StatusCell from './StatusCell';
import { ServiceCell } from './ServiceCell';
import { Edit, Search, Delete, FilterList } from '@mui/icons-material';
import { FilterRow } from './FilterRow';
import { BackstageEntity } from '../../types';
import useDebounce from '../../../hooks/useDebounce';
import MappingToast, { MappingCounts, ToastSeverity } from './MappingToast';
import { useEntityMappings } from './hooks/useEntityMappings';
import { useConfirmMappings } from './hooks/useConfirmMappings';
import { useQueryClient } from '@tanstack/react-query';

export interface AutoMatchResult {
  score: number;
  serviceId: string;
  account: string;
  serviceName: string;
}

export type AutoMatchResults = Record<string, AutoMatchResult>;

export default function MappingsTable() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMappingOpen, setIsAutoMappingOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BackstageEntity | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    name: '',
    serviceName: '',
    status: '',
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

  const clearMatches = () => {
    setAutoMatchResults({});
  };

  const setMatches = (results: AutoMatchResults) => {
    setAutoMatchResults(results);
  };

  const removeMatch = (entityName: string) => {
    setAutoMatchResults(prev => {
      const updated = { ...prev };
      delete updated[entityName];
      return updated;
    });
  };

  const handleFilterChange = useCallback(
    (key: keyof typeof filters, value: string) => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setOffset(0);
    }, [],
  );

  const { mappings, entitiesWithScores } = useEntityMappings(
    offset,
    pageSize,
    debouncedFilters,
    autoMatchResults,
  );

  const { confirmMappings, isConfirming } = useConfirmMappings({
    autoMatchResults,
    mappingEntities: mappings?.entities,
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

        <SearchField
          size="small"
          placeholder="Search for components or teams"
          style={{
            maxWidth: '250px',
          }}
          icon={<Search />}
          value={searchQuery}
          onChange={value => {
            setSearchQuery(value);
            setOffset(0);
          }}
        />

        <ButtonIcon
          icon={<FilterList />}
          aria-label="Toggle filters"
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'primary' : 'secondary'} >
          <FilterList />
        </ButtonIcon>
      </Flex>
      <Table selectionMode="none">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column isRowHeader>Team</Column>
          <Column isRowHeader>PagerDuty service</Column>
          <Column isRowHeader>Status</Column>
          <Column isRowHeader>Account</Column>
          <Column isRowHeader>Mapping Score</Column>
          <Column isRowHeader>Actions</Column>
        </TableHeader>
        <TableBody>
          {showFilters && (<FilterRow filters={filters} onFilterChange={handleFilterChange} />)}
          
          {entitiesWithScores?.map((entity: BackstageEntity) => (
            <Row key={entity.id}>
              <CellText title={entity.name} />
              <CellText title={entity.owner} />
              <ServiceCell entity={entity} />
              <StatusCell entity={entity} />
              <CellText
                title={entity.account === '' ? 'default' : entity.account!}
              />
              <CellText
                title={
                  entity.mappingScore !== undefined
                    ? `${entity.mappingScore}%`
                    : '—'
                }
              />
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
            </Row>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        offset={offset}
        pageSize={pageSize}
        setPageSize={setPageSize}
        setOffset={setOffset}
        rowCount={mappings?.totalCount || 0}
        onNextPage={() => setOffset(offset + pageSize)}
        onPreviousPage={() => setOffset(Math.max(0, offset - pageSize))}
        onPageSizeChange={newPageSize => {
          setPageSize(newPageSize);
          setOffset(0);
        }}
        showPageSizeOptions
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
