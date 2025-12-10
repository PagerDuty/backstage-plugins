import {
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TablePagination,
  Cell,
  SearchField,
  Flex,
} from '@backstage/ui';
import { useState } from 'react';
import MappingsDialog from '../MappingsDialog';
import { Edit, Search } from '@mui/icons-material';
import StatusCell from './StatusCell';
import { ServiceCell } from './ServiceCell';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../api';
import { useDebounce } from 'react-use';
import { BackstageEntity } from '../../types';

export default function MappingsTable() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BackstageEntity | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 500, [searchQuery]);
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const { data: enhancedMappingsResponse, refetch } = useQuery({
    queryKey: [
      'pagerduty',
      'enhancedEntityMappings',
      {
        offset,
        pageSize,
        search: debouncedSearchQuery,
      },
    ],
    queryFn: () =>
      pagerDutyApi.getEntityMappingsWithPagination({
        offset,
        limit: pageSize,
        search: debouncedSearchQuery,
        searchFields: ['metadata.name', 'spec.owner'],
      }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <Flex justify="end" gap="2">
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
          <Column isRowHeader>Actions</Column>
        </TableHeader>
        <TableBody>
          {enhancedMappingsResponse?.entities.map((entity: BackstageEntity) => (
            <Row key={entity.id}>
              <Cell title={entity.name} />
              <Cell title={entity.owner} />
              <ServiceCell entity={entity} />
              <StatusCell entity={entity} />
              <Cell
                leadingIcon={<Edit fontSize="small" />}
                color="secondary"
                style={{ paddingLeft: '25px' }}
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
        rowCount={enhancedMappingsResponse?.totalCount || 0}
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
        refetchMappings={refetch}
      />
    </>
  );
}
