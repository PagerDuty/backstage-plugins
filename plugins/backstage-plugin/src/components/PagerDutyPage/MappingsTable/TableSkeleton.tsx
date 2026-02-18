import { Box, Flex, Skeleton } from '@backstage/ui';

export function TableSkeleton() {
  return (
    <Box style={{ width: '100%' }} mt="4">
      <Flex
        gap="4"
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--bui-border-neutral-default)',
          backgroundColor: 'var(--bui-bg-surface-0)',
        }}
      >
        <Skeleton style={{ height: '20px', width: '15%' }} />
        <Skeleton style={{ height: '20px', width: '15%' }} />
        <Skeleton style={{ height: '20px', width: '20%' }} />
        <Skeleton style={{ height: '20px', width: '12%' }} />
        <Skeleton style={{ height: '20px', width: '12%' }} />
        <Skeleton style={{ height: '20px', width: '12%' }} />
        <Skeleton style={{ height: '20px', width: '10%' }} />
      </Flex>

      {[...Array(10)].map((_, index) => (
        <Flex
          key={index}
          gap="4"
          style={{
            padding: '1rem',
            borderBottom: '1px solid var(--bui-border-neutral-subtle)',
          }}
        >
          <Skeleton style={{ height: '16px', width: '15%' }} />
          <Skeleton style={{ height: '16px', width: '15%' }} />
          <Skeleton style={{ height: '16px', width: '20%' }} />
          <Skeleton style={{ height: '16px', width: '12%' }} />
          <Skeleton style={{ height: '16px', width: '12%' }} />
          <Skeleton style={{ height: '16px', width: '12%' }} />
          <Skeleton style={{ height: '16px', width: '10%' }} />
        </Flex>
      ))}
    </Box>
  );
}
