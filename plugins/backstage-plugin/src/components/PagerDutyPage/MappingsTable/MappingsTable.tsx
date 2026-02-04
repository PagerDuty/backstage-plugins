import {
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TablePagination,
  CellText,
  SearchField,
  Flex,
} from '@backstage/ui';
import { useState } from 'react';
import MappingsDialog from '../MappingsDialog';
import AutomaticMappingsDialog from '../AutomaticMappingsDialog';
import AutoMappingsButton from './AutoMappingsButton';
import { Edit, Search } from '@mui/icons-material';
import StatusCell from './StatusCell';
import { ServiceCell } from './ServiceCell';
import { BackstageEntity } from '../../types';
import useDebounce from '../../../hooks/useDebounce';
import MappingToast from './MappingToast';
import { useAutoMatchResults } from './hooks/useAutoMatchResults';
import { useMappingToast } from './hooks/useMappingToast';
import { useEntityMappings } from './hooks/useEntityMappings';
import { useConfirmMappings } from './hooks/useConfirmMappings';

export default function MappingsTable() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMappingOpen, setIsAutoMappingOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BackstageEntity | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery);

  const { autoMatchResults, hasMatches, setMatches, clearMatches } =
    useAutoMatchResults();
  const {
    showToast,
    toastMessage,
    toastSeverity,
    totalMatches,
    mappingCounts,
    showSuccess,
    showError,
    closeToast,
  } = useMappingToast();
  const { mappings, entitiesWithScores } = useEntityMappings(
    offset,
    pageSize,
    debouncedSearchQuery,
    autoMatchResults,
  );

  const { confirmMappings, isConfirming } = useConfirmMappings({
    autoMatchResults,
    mappingEntities: mappings?.entities,
    onSuccess: (successCount, totalCount, counts) => {
      showSuccess(
        `${successCount} of ${totalCount} mappings saved successfully.`,
        undefined,
        counts,
      );
    },
    onError: showError,
    onClear: clearMatches,
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
      </Flex>
      <Table>
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column isRowHeader>Team</Column>
          <Column isRowHeader>PagerDuty service</Column>
          <Column isRowHeader>Status</Column>
          <Column isRowHeader>Mapping Score</Column>
          <Column isRowHeader>Actions</Column>
        </TableHeader>
        <TableBody>
          {entitiesWithScores?.map((entity: BackstageEntity) => (
            <Row key={entity.id}>
              <CellText title={entity.name} />
              <CellText title={entity.owner} />
              <ServiceCell entity={entity} />
              <StatusCell entity={entity} />
              <CellText
                title={
                  entity.mappingScore !== undefined
                    ? `${entity.mappingScore}%`
                    : '—'
                }
              />
              <CellText
                leadingIcon={<Edit fontSize="small" />}
                color="secondary"
                style={{
                  paddingLeft: '25px',
                  cursor: 'pointer',
                  maxWidth: 'min-content',
                }}
                title=""
                onClick={() => {
                  setIsOpen(true);
                  setSelectedEntity(entity);
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
          showSuccess(
            `${matchCount} services mapped successfully.`,
            matchCount,
          );
        }}
      />
      <MappingToast
        open={showToast}
        onClose={closeToast}
        severity={toastSeverity}
        message={toastMessage}
        totalMatches={totalMatches}
        mappingCounts={mappingCounts}
      />
    </>
  );
}
