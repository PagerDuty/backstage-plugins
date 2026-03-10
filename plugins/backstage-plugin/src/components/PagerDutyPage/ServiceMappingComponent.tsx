import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MappingsTable from './MappingsTable/MappingsTable';
import { Card, CardBody, Select, Flex, Text } from '@backstage/ui';
import { AccountProvider, useAccountContext } from './AccountContext';
import { makeStyles } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';

const useStyles = makeStyles<BackstageTheme>(() => ({
  accountCard: {
    marginBottom: '16px',
    width: 'fit-content',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 102, 204, 0.1)',
    border: '1px solid #e0e0e0',
  },
  accountCardBody: {
    padding: '16px 20px !important',
  },
  accountLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '8px',
  },
  requiredIndicator: {
    display: 'inline-block',
    color: '#dc3545',
    fontWeight: 700,
    marginLeft: '2px',
  },
  accountSelect: {
    minWidth: '200px',
  },
  mainCard: {
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
  },
  helpText: {
    fontSize: '13px',
    color: '#666',
    fontStyle: 'italic',
    marginTop: '6px',
  },
}));

const ServiceMappingContent = () => {
  const { selectedAccount, setSelectedAccount, accounts } = useAccountContext();
  const classes = useStyles();

  return (
    <>
      {accounts.length > 0 && (
        <Card className={classes.accountCard}>
          <CardBody className={classes.accountCardBody}>
            <Flex direction="column" gap="2">
              <Text className={classes.accountLabel}>
                Please Select an Account:
                <div className={classes.requiredIndicator}>*</div>
              </Text>
              <Select
                selectionMode="single"
                size="small"
                value={selectedAccount}
                onChange={value => setSelectedAccount(value?.toString() || '')}
                placeholder="Select account"
                options={accounts}
                className={classes.accountSelect}
              />
            </Flex>
          </CardBody>
        </Card>
      )}
      <Card className={classes.mainCard}>
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
