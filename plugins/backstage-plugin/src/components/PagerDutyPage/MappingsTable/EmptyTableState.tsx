import { Flex, Text } from '@backstage/ui';

interface EmptyTableStateProps {
  hasActiveFilters: boolean;
}

export function EmptyTableState({ hasActiveFilters }: EmptyTableStateProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      style={{
        padding: '3rem',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <Text variant="title-medium" weight="bold">
        No service mappings found
      </Text>
      <Text variant="body-medium" color="secondary">
        {hasActiveFilters
          ? 'Try adjusting your filters to see more results.'
          : 'No Backstage entities found. You can only map PagerDuty services to existing Backstage entities.'}
      </Text>
    </Flex>
  );
}
