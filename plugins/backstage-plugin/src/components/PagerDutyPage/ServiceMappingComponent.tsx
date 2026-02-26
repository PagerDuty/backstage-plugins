import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MappingsTable from './MappingsTable/MappingsTable';
import { Card, CardBody, Select, Flex, Text } from '@backstage/ui';
import { AccountProvider, useAccountContext } from './AccountContext';

const ServiceMappingContent = () => {
  const { selectedAccount, setSelectedAccount, accounts } = useAccountContext();

  return (
    <>
      {accounts.length > 0 && (
        <Card style={{ marginBottom: 4, width: 'fit-content' }}>
          <CardBody>
            <Flex direction="column" gap="2">
              <Text style={{ fontSize: '14px', fontWeight: 500 }}>
                Please Select an Account:
              </Text>
              <Select
                selectionMode="single"
                size="small"
                value={selectedAccount}
                onChange={value => setSelectedAccount(value?.toString() || '')}
                placeholder="Select account"
                options={accounts}
                style={{ minWidth: '200px' }}
              />
            </Flex>
          </CardBody>
        </Card>
      )}
      <Card>
        <CardBody>
          <MappingsTable key={selectedAccount} />
        </CardBody>
      </Card>
    </>
  );
};

export const ServiceMappingComponent = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <ServiceMappingContent />
      </AccountProvider>
    </QueryClientProvider>
  );
};
