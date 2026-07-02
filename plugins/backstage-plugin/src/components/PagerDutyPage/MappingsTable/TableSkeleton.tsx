import { Box, Flex, Skeleton, Text } from '@backstage/ui';

interface SkeletonColumn {
  /** Column header label, matching the real table's column. */
  label: string;
  /** Column width as a CSS width value. */
  width: string;
}

interface TableSkeletonProps {
  /**
   * Columns to render. The labels match the real table's headers and are shown
   * as-is; only the row cells are skeletons.
   */
  columns?: SkeletonColumn[];
  /** Number of placeholder rows to render. */
  rowCount?: number;
}

const DEFAULT_COLUMNS: SkeletonColumn[] = [
  { label: 'Name', width: '25%' },
  { label: 'Team', width: '20%' },
  { label: 'PagerDuty service', width: '25%' },
  { label: 'Status', width: '20%' },
  { label: 'Actions', width: '10%' },
];

export function TableSkeleton({
  columns = DEFAULT_COLUMNS,
  rowCount = 10,
}: TableSkeletonProps = {}) {
  return (
    <Box data-testid="mappings-table-skeleton" style={{ width: '100%' }}>
      <Flex
        gap="4"
        mt="10px"
        pl="10px"
      >
        {columns.map(column => (
          <Box key={column.label} style={{ width: column.width }}>
            <Text weight="bold" variant="body-medium">
              {column.label}
            </Text>
          </Box>
        ))}
      </Flex>

      {[...Array(rowCount)].map((_, rowIndex) => (
        <Flex
          key={rowIndex}
          gap="4"
          style={{
            padding: '1rem',
            borderBottom: '1px solid var(--bui-border-neutral-subtle)',
          }}
        >
          {columns.map(column => (
            <Skeleton
              key={column.label}
              style={{ height: '16px', width: column.width }}
            />
          ))}
        </Flex>
      ))}
    </Box>
  );
}
