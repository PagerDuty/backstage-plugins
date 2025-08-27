/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ReactNode, useCallback, useState } from 'react';
import { Typography, Divider } from '@material-ui/core';
import { Incidents } from '../Incident';
import { EscalationPolicy } from '../Escalation';
import useAsync from 'react-use/lib/useAsync';
import { pagerDutyApiRef, UnauthorizedError } from '../../api';
import { MissingTokenError, ServiceNotFoundError } from '../Errors';
import { ChangeEvents } from '../ChangeEvents';
import PDGreenImage from '../../assets/PD-Green.svg';
import PDWhiteImage from '../../assets/PD-White.svg';

import { useApi } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { Progress, InfoCard } from '@backstage/core-components';
import { PagerDutyEntity } from '../../types';
import { ForbiddenError } from '../Errors/ForbiddenError';
import {
  InsightsCard,
  OpenServiceButton,
  ServiceStandardsCard,
  StatusCard,
  TriggerIncidentButton,
} from '../PagerDutyCardCommon';
import { createStyles, makeStyles, useTheme } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';
import { PagerDutyCardServiceResponse } from '../../api/types';
import { Card, Flex, Grid, Tab, TabList, TabPanel, Tabs } from '@backstage/ui';

const useStyles = makeStyles<BackstageTheme>(theme =>
  createStyles({
    overviewHeaderTextStyle: {
      fontSize: '14px',
      fontWeight: 500,
      color:
        theme.palette.type === 'light'
          ? 'rgba(0, 0, 0, 0.54)'
          : 'rgba(255, 255, 255, 0.7)',
    },
    oncallHeaderTextStyle: {
      fontSize: '14px',
      fontWeight: 500,
      marginTop: '10px',
      marginLeft: '10px',
      color:
        theme.palette.type === 'light'
          ? 'rgba(0, 0, 0, 0.54)'
          : 'rgba(255, 255, 255, 0.7)',
    },

    subheaderTextStyle: {
      fontSize: '10px',
      marginLeft: '-10px',
      paddingTop: '3px',
    },
  }),
);

const BasicCard = ({ children }: { children: ReactNode }) => (
  <InfoCard title="PagerDuty">{children}</InfoCard>
);

/** @public */
export type PagerDutyCardProps = PagerDutyEntity & {
  readOnly?: boolean;
  disableChangeEvents?: boolean;
  disableOnCall?: boolean;
};

/** @public */
export const PagerDutyCard = (props: PagerDutyCardProps) => {
  const classes = useStyles();

  const theme = useTheme();
  const { readOnly, disableChangeEvents, disableOnCall } = props;
  const api = useApi(pagerDutyApiRef);
  const [refreshIncidents, setRefreshIncidents] = useState<boolean>(false);
  const [refreshChangeEvents, setRefreshChangeEvents] =
    useState<boolean>(false);
  const [refreshStatus, setRefreshStatus] = useState<boolean>(false);

  const handleRefresh = useCallback(() => {
    setRefreshIncidents(x => !x);
    setRefreshChangeEvents(x => !x);
    setRefreshStatus(x => !x);
  }, []);

  const {
    value: service,
    loading,
    error,
  } = useAsync(async () => {
    const { service: foundService } = await api.getServiceByPagerDutyEntity(
      props,
    );

    const serviceStandards = await api.getServiceStandardsByServiceId(
      foundService.id,
      props.account,
    );

    const serviceMetrics = await api.getServiceMetricsByServiceId(
      foundService.id,
      props.account,
    );

    const result: PagerDutyCardServiceResponse = {
      id: foundService.id,
      account: props.account,
      name: foundService.name,
      url: foundService.html_url,
      policyId: foundService.escalation_policy.id,
      policyLink: foundService.escalation_policy.html_url as string,
      policyName: foundService.escalation_policy.name,
      status: foundService.status,
      standards:
        serviceStandards !== undefined ? serviceStandards.standards : undefined,
      metrics:
        serviceMetrics !== undefined ? serviceMetrics.metrics : undefined,
    };

    return result;
  }, [props]);

  if (error) {
    let errorNode: ReactNode;

    switch (error.constructor) {
      case UnauthorizedError:
        errorNode = <MissingTokenError />;
        break;
      case NotFoundError:
        errorNode = <ServiceNotFoundError />;
        break;
      default:
        errorNode = <ForbiddenError />;
    }

    return <BasicCard>{errorNode}</BasicCard>;
  }

  if (loading) {
    return (
      <BasicCard>
        <Progress />
      </BasicCard>
    );
  }

  return (
    <Card data-testid="pagerduty-card">
      <Grid.Root columns="6">
        <Grid.Item colSpan="4">
          <Flex pl="20px" align="center" style={{ height: '100%' }}>
            {theme.palette.type === 'dark' ? (
              <img src={PDWhiteImage} alt="PagerDuty" height="35" />
            ) : (
              <img src={PDGreenImage} alt="PagerDuty" height="35" />
            )}
          </Flex>
        </Grid.Item>
        <Grid.Item colSpan="2">
          <Flex justify="end">
            {!readOnly && props.integrationKey ? (
              <Flex>
                <TriggerIncidentButton
                  data-testid="trigger-incident-button"
                  integrationKey={props.integrationKey}
                  entityName={props.name}
                  handleRefresh={handleRefresh}
                />
                <OpenServiceButton serviceUrl={service!.url} />
              </Flex>
            ) : (
              <OpenServiceButton serviceUrl={service!.url} />
            )}
          </Flex>
        </Grid.Item>
      </Grid.Root>
      <Grid.Root columns="4" gap="1" pl="1" pr="1">
        <Grid.Item colSpan="1">
          <Typography className={classes.overviewHeaderTextStyle}>
            STATUS
          </Typography>
        </Grid.Item>
        <Grid.Item colSpan="2">
          <Flex>
            <Typography className={classes.overviewHeaderTextStyle}>
              INSIGHTS
            </Typography>
            <Typography className={classes.subheaderTextStyle}>
              (last 30 days)
            </Typography>
          </Flex>
        </Grid.Item>
        <Grid.Item colSpan="1">
          <Typography className={classes.overviewHeaderTextStyle}>
            STANDARDS
          </Typography>
        </Grid.Item>
      </Grid.Root>

      <Grid.Root gap="1" columns="4" pl="1" pr="1">
        <Grid.Item colSpan="1">
          <StatusCard
            serviceId={service!.id}
            account={service!.account}
            refreshStatus={refreshStatus}
          />
        </Grid.Item>
        <Grid.Item colSpan="2">
          <Grid.Root gap="1" columns="3" pl="1" pr="1">
            <Grid.Item>
              <InsightsCard
                count={
                  service?.metrics !== undefined && service.metrics.length > 0
                    ? service?.metrics[0].total_interruptions
                    : undefined
                }
                label="interruptions"
                color={theme.palette.textSubtle}
              />
            </Grid.Item>
            <Grid.Item>
              <InsightsCard
                count={
                  service?.metrics !== undefined && service.metrics.length > 0
                    ? service?.metrics[0].total_high_urgency_incidents
                    : undefined
                }
                label="high urgency"
                color={theme.palette.warning.main}
              />
            </Grid.Item>
            <Grid.Item>
              <InsightsCard
                count={
                  service?.metrics !== undefined && service?.metrics?.length > 0
                    ? service?.metrics[0].total_incident_count
                    : undefined
                }
                label="incidents"
                color={theme.palette.error.main}
              />
            </Grid.Item>
          </Grid.Root>
        </Grid.Item>
        <Grid.Item colSpan="1">
          <ServiceStandardsCard
            total={
              service?.standards?.score !== undefined
                ? service?.standards?.score?.total
                : undefined
            }
            completed={
              service?.standards?.score !== undefined
                ? service?.standards?.score?.passing
                : undefined
            }
            standards={
              service?.standards !== undefined
                ? service?.standards?.standards
                : undefined
            }
          />
        </Grid.Item>
      </Grid.Root>

      <Divider />

      <Tabs>
        <TabList>
          <Tab id="tab-1">Incidents</Tab>
          {disableChangeEvents !== true && <Tab id="tab-2">Change Events</Tab>}
        </TabList>
        <TabPanel id="tab-1">
          <Incidents
            serviceId={service!.id}
            refreshIncidents={refreshIncidents}
            account={service!.account}
          />
        </TabPanel>
        {disableChangeEvents !== true && (
          <TabPanel id="tab-2">
            <ChangeEvents
              data-testid="change-events"
              serviceId={service!.id}
              refreshEvents={refreshChangeEvents}
              account={service!.account}
            />
          </TabPanel>
        )}
      </Tabs>
      {disableOnCall !== true && (
        <>
          <Typography className={classes.oncallHeaderTextStyle}>
            ON CALL
          </Typography>
          <EscalationPolicy
            data-testid="oncall-card"
            policyId={service!.policyId}
            policyUrl={service!.policyLink}
            policyName={service!.policyName}
            account={service!.account}
          />
        </>
      )}
    </Card>
  );
};
