import { useEffect, useState } from 'react';
import { createStyles, makeStyles, Typography } from '@material-ui/core';
import { Card, RadioGroup, Radio, Box, Alert } from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { BackstageTheme } from '@backstage/theme';
import { pagerDutyApiRef } from '../../api';

enum StoreSettings {
  backstage = 'backstage',
  pagerduty = 'pagerduty',
  both = 'both',
  disabled = 'disabled',
}

const SERVICE_DEPENDENCY_SYNC_STRATEGY =
  'settings::service-dependency-sync-strategy';

const useStyles = makeStyles<BackstageTheme>(() =>
  createStyles({
    cardStyles: {
      padding: '15px',
      marginTop: '16px',
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

  const handleChange = (value: StoreSettings) => {
    setSelectedServiceDependencyStrategy(value);
    pagerDutyApi.storeSettings([
      {
        id: SERVICE_DEPENDENCY_SYNC_STRATEGY,
        value,
      },
    ]);
  };

  return (
    <Box pl="20px" pr="20px">
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
          onChange={value => handleChange(value as StoreSettings)}
        >
          <Radio value={StoreSettings.backstage}>Backstage</Radio>
          <Radio value={StoreSettings.pagerduty}>PagerDuty</Radio>
          <Radio value={StoreSettings.both}>Both</Radio>
          <Radio value={StoreSettings.disabled}>Disabled</Radio>
        </RadioGroup>

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
      </Card>
    </Box>
  );
};
