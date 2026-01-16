import { useEffect, useState } from 'react';
import { createStyles, makeStyles, Typography } from '@material-ui/core';
import { Card, Grid, RadioGroup, Radio } from '@backstage/ui';
import {
  Header,
  Page,
  Content,
  TabbedLayout,
} from '@backstage/core-components';
import { ServiceMappingComponent } from './ServiceMappingComponent';
import { AutoMatchTestComponent } from './AutoMatchTestComponent';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';
import { NotFoundError } from '@backstage/errors';
import { BackstageTheme } from '@backstage/theme';

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
export const PagerDutyPage = () => {
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
    <Page themeId="home">
      <Header title="PagerDuty" subtitle="Advanced configurations" />
      <Content>
        <TabbedLayout>
          <TabbedLayout.Route path="/service-mapping" title="Service Mapping">
            <Grid.Root gap="3" columns="1">
              <Grid.Item>
                <Typography>
                  Easily map your existing PagerDuty services to entities in
                  Backstage without the need to add anotations to all your
                  projects.
                </Typography>
                <Typography>
                  <b>Warning: </b>Only 1:1 mapping is allowed at this time.
                </Typography>
              </Grid.Item>
              <Grid.Item>
                <ServiceMappingComponent />
              </Grid.Item>
            </Grid.Root>
          </TabbedLayout.Route>
          <TabbedLayout.Route path="/settings" title="Configuration">
            <>
              <Typography variant="h4">Plugin configuration</Typography>
              <Typography>
                Configure your PagerDuty plugin configuration here
              </Typography>

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

                <div className={textContainerStyles}>
                  <Typography>
                    <b>Warning: </b>Changing this setting will affect how your
                    service dependencies are synchronized and may cause data
                    loss. Check the{' '}
                    <a
                      className={linkStyles}
                      href="https://pagerduty.github.io/backstage-plugin-docs/index.html"
                    >
                      documentation
                    </a>{' '}
                    for more information.
                  </Typography>
                </div>
              </Card>
            </>
          </TabbedLayout.Route>
          <TabbedLayout.Route path="/auto-match-test" title="🧪 Auto-Match Test">
            <AutoMatchTestComponent />
          </TabbedLayout.Route>
        </TabbedLayout>
      </Content>
    </Page>
  );
};
