import { createContext, useContext, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';

interface AccountContextValue {
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;
  accounts: Array<{ label: string; value: string }>;
  isLoading: boolean;
}

const AccountContext = createContext<AccountContextValue | undefined>(
  undefined,
);

export const useAccountContext = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccountContext must be used within an AccountProvider');
  }
  return context;
};

interface AccountProviderProps {
  children: React.ReactNode;
}

export const AccountProvider = ({ children }: AccountProviderProps) => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['pagerduty', 'accounts'],
    queryFn: () => pagerDutyApi.getAccounts(),
  });

  const accounts = useMemo(() => {
    if (accountsData && accountsData.length > 0) {
      return accountsData.map(account => ({
        label: account.id,
        value: account.id,
      }));
    }
    return [];
  }, [accountsData]);

  useMemo(() => {
    if (accountsData && accountsData.length > 0 && !selectedAccount) {
      const defaultAccount = accountsData.find(account => account.isDefault);
      if (defaultAccount) {
        setSelectedAccount(defaultAccount.id);
      } else {
        setSelectedAccount(accountsData[0].id);
      }
    }
  }, [accountsData, selectedAccount]);

  const value = useMemo(
    () => ({
      selectedAccount,
      setSelectedAccount,
      accounts,
      isLoading,
    }),
    [selectedAccount, accounts, isLoading],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
};
