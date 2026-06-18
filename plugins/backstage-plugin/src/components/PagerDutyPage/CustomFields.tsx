import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Select,
  Switch,
  Text,
} from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { makeStyles } from '@material-ui/core';
import { pagerDutyApiRef } from '../../api';
import type { PagerDutySetting } from '@pagerduty/backstage-plugin-common';
import { ButtonTabs, ButtonTabItem } from './CustomFields/ButtonTabs';
import { CustomFieldsTabPanel } from './CustomFields/CustomFieldsTabPanel';
import { SyncLogsTab } from './CustomFields/SyncLogsTab';
import { AccountProvider, useAccountContext } from './AccountContext';
import { CustomFieldModal, FieldErrors } from './CustomFieldModal';
import { toFieldErrors } from './CustomFields/customFieldErrors';

const queryClient = new QueryClient();

const DATA_SYNC_SETTING_ID = 'settings::data-sync';

// The data-sync toggle reuses the generic settings store but with its own
// enabled/disabled value, distinct from the dependency-strategy PagerDutySetting.
type DataSyncSetting = { id: string; value: 'enabled' | 'disabled' };

const useStyles = makeStyles(() => ({
  syncCardWrapper: {
    minWidth: 220,
  },
  syncCardBody: {
    padding: '8px 12px',
  },
  accountSelector: {
    width: 240,
  },
}));

type TabKey = 'fields' | 'logs';

const TABS: ButtonTabItem<TabKey>[] = [
  { key: 'fields', label: 'Custom Fields' },
  { key: 'logs', label: 'Activity Logs' },
];

const CustomFieldsTabContent = () => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const reactQueryClient = useQueryClient();
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState<TabKey>('fields');
  const { selectedAccount, setSelectedAccount, accounts } = useAccountContext();
  const account = selectedAccount || undefined;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<FieldErrors | null>(null);

  const showAccountSelector = accounts.length > 1;

  const { data: orgWideSyncOn = false } = useQuery({
    queryKey: ['pagerduty', 'settings', DATA_SYNC_SETTING_ID],
    queryFn: async () => {
      try {
        const result = (await pagerDutyApi.getSetting(
          DATA_SYNC_SETTING_ID,
        )) as DataSyncSetting;
        return result?.value === 'enabled';
      } catch (error) {
        if (error instanceof NotFoundError) {
          // The setting has never been saved — treat the sync as disabled.
          return false;
        }
        throw error;
      }
    },
  });

  const { mutate: toggleSync } = useMutation({
    mutationFn: (enabled: boolean) => {
      const setting: DataSyncSetting = {
        id: DATA_SYNC_SETTING_ID,
        value: enabled ? 'enabled' : 'disabled',
      };
      return pagerDutyApi.storeSettings([setting as PagerDutySetting]);
    },
    onMutate: (enabled: boolean) => {
      // Optimistically reflect the toggle while the request is in flight.
      reactQueryClient.setQueryData(
        ['pagerduty', 'settings', DATA_SYNC_SETTING_ID],
        enabled,
      );
    },
    onError: (_error, enabled: boolean) => {
      // Roll back to the previous value on failure.
      reactQueryClient.setQueryData(
        ['pagerduty', 'settings', DATA_SYNC_SETTING_ID],
        !enabled,
      );
    },
  });

  const handleOpenAdd = () => {
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    setAddError(null);
  };

  const handleSaveAdd = async (formData: { name: string; entityPath: string; description: string }) => {
    setAddSaving(true);
    setAddError(null);
    const result = await pagerDutyApi.createCustomField(formData, account);
    if (result.status === 'ok') {
      reactQueryClient.invalidateQueries({ queryKey: ['pagerduty', 'customFields', account ?? ''] });
      setIsAddModalOpen(false);
    } else {
      setAddError(toFieldErrors(result.error));
    }
    setAddSaving(false);
  };

  return (
    <Box pl="20px" pr="20px">
      <Alert
        status="info"
        icon
        title="Enrich your PagerDuty services with data from your Backstage catalog."
        description="Create custom field mappings to surface the right context — runbook links, team ownership, and more — directly in PagerDuty."
        style={{marginBottom: '8px'}}
      />
      <Card>
        <CardHeader>
          <Flex align="start" justify="between" gap="3">
            <Flex direction="column" gap="1">
              <Text variant="body-medium" weight="bold">
                Manage your custom fields and review their sync activity.
              </Text>
            </Flex>
            <Box className={classes.syncCardWrapper}>
              <Card>
                <CardBody className={classes.syncCardBody}>
                  <Flex align="center" justify="between" gap="2">
                    <Text
                      variant="body-small"
                      weight="bold"
                      color={orgWideSyncOn ? 'success' : 'secondary'}
                    >
                      Org-Wide Data Sync: {orgWideSyncOn ? 'On' : 'Off'}
                    </Text>
                    <Switch
                      isSelected={orgWideSyncOn}
                      onChange={toggleSync}
                      aria-label="Toggle org-wide data sync"
                    />
                  </Flex>
                </CardBody>
              </Card>
            </Box>
          </Flex>
        </CardHeader>

        <CardBody>
          <Flex align="end" justify="between" gap="3" mb="4">
            <Flex align="end" gap="3">
              {showAccountSelector && (
                <Box className={classes.accountSelector}>
                  <Select
                    label="Select Account"
                    isRequired
                    selectionMode="single"
                    size="small"
                    value={selectedAccount}
                    onChange={value => setSelectedAccount(value?.toString() ?? '')}
                    placeholder="Select account"
                    options={accounts}
                  />
                </Box>
              )}
              <ButtonTabs<TabKey>
                items={TABS}
                value={activeTab}
                onChange={setActiveTab}
              />
            </Flex>
            <Button
              variant="secondary"
              size="small"
              onClick={handleOpenAdd}
            >
              + Add New
            </Button>
          </Flex>

          {activeTab === 'fields' ? (
            <CustomFieldsTabPanel key={selectedAccount} />
          ) : (
            <SyncLogsTab key={selectedAccount} />
          )}
        </CardBody>

        <CustomFieldModal
          open={isAddModalOpen}
          saving={addSaving}
          error={addError}
          onClose={handleCloseAdd}
          onSave={handleSaveAdd}
          mode="add"
        />
      </Card>
    </Box>
  );
};

/** @public */
export const CustomFields = () => (
  <QueryClientProvider client={queryClient}>
    <AccountProvider>
      <CustomFieldsTabContent />
    </AccountProvider>
  </QueryClientProvider>
);
