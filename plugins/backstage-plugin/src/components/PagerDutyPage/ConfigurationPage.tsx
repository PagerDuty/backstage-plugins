import { useEffect, useState } from 'react';
import { createStyles, makeStyles, Typography } from '@material-ui/core';
import { Card, RadioGroup, Radio, Box, Alert } from '@backstage/ui';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { pagerDutyApiRef } from '../../api';

enum StoreSettings {
  backstage = 'backstage',
  pagerduty = 'pagerduty',
  both = 'both',
  disabled = 'disabled',
}

const SERVICE_DEPENDENCY_SYNC_STRATEGY =
  'settings::service-dependency-sync-strategy';

const useStyles = makeStyles(() =>
  createStyles({
    cardStyles: {
      padding: '15px',
      marginTop: '8px',
      paddingBottom: "20px"
    },
    textContainerStyles: {
      marginTop: '16px',
    },
    linkStyles: {
      color: 'cadetblue',
    },
  }),
);

/** @public */
export const ConfigurationPage = () => {
  const { cardStyles, textContainerStyles, linkStyles } = useStyles();
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const alertApi = useApi(alertApiRef);
  const [
    selectedServiceDependencyStrategy,
    setSelectedServiceDependencyStrategy,
  ] = useState('disabled');

  useEffect(() => {
    function fetchSetting() {
      pagerDutyApi
        .getSetting(SERVICE_DEPENDENCY_SYNC_STRATEGY)
        .then(result => {
          if (result !== undefined) {
            setSelectedServiceDependencyStrategy(result.value);
          }
        })
        .catch(error => {
          if (error instanceof NotFoundError) {
            // If the setting is not found, set the default value to "disabled"
            setSelectedServiceDependencyStrategy('disabled');
          }
        });
    }

    fetchSetting();
  }, [pagerDutyApi]);

  const handleChange = async (value: StoreSettings) => {
    // Optimistically reflect the selection, remembering the previous value so we
    // can roll back if the save fails — otherwise the radio would show a setting
    // that was never persisted and silently revert on the next page load.
    const previousValue = selectedServiceDependencyStrategy;
    setSelectedServiceDependencyStrategy(value);

    try {
      await pagerDutyApi.storeSettings([
        {
          id: SERVICE_DEPENDENCY_SYNC_STRATEGY,
          value,
        },
      ]);
    } catch (error) {
      setSelectedServiceDependencyStrategy(previousValue);
      alertApi.post({
        message: `Failed to save service dependency synchronization strategy. ${
          error instanceof Error ? error.message : error
        }`,
        severity: 'error',
      });
    }
  };

  return (
    <Box pl="20px" pr="20px">
      <Alert
        className={textContainerStyles}
        status="warning"
        icon
        title="Changing this setting will affect how your service dependencies are synchronized and may cause data loss."
        description={
          <>
            Check the{' '}
            <a
              className={linkStyles}
              href="https://pagerduty.github.io/backstage-plugin-docs/index.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              documentation
            </a>{' '}
            for more information.
          </>
        }
      />
      <Card
        title="Service dependency synchronization preferences"
        className={cardStyles}
      >
        <Typography variant="h6">
          Service dependency synchronization strategy
        </Typography>
        <RadioGroup
          label="Select the main source of truth for your service dependencies"
          value={selectedServiceDependencyStrategy}
          onChange={value => void handleChange(value as StoreSettings)}
        >
          <Radio value={StoreSettings.backstage}>Backstage</Radio>
          <Radio value={StoreSettings.pagerduty}>PagerDuty</Radio>
          <Radio value={StoreSettings.both}>Both</Radio>
          <Radio value={StoreSettings.disabled}>Disabled</Radio>
        </RadioGroup>
      </Card>
    </Box>
  );
};
