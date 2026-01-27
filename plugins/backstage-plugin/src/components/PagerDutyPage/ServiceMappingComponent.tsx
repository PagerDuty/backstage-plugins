import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MappingsTable from './MappingsTable/MappingsTable';
import { Card, CardBody } from '@backstage/ui';

export const ServiceMappingComponent = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <Card>
        <CardBody>
          <MappingsTable />
        </CardBody>
      </Card>
    </QueryClientProvider>
  );
};
