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
// eslint-disable-next-line @backstage/no-undeclared-imports
import { ReactNode, useCallback, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  CardHeader
} from '@material-ui/core';
import { Card, Flex, Grid, Text } from '@backstage/ui';
import useAsync from 'react-use/lib/useAsync';
import { pagerDutyApiRef, UnauthorizedError } from '../../api';
import { MissingTokenError, ServiceNotFoundError } from '../Errors';
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
import { EscalationPolicy } from '../Escalation';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Entity } from '@backstage/catalog-model';

const useStyles = makeStyles<BackstageTheme>(_ =>
  createStyles({
    subheaderTextStyle: {
      fontSize: '10px',
      paddingLeft: '5px',
      paddingTop: '3px',
    },

    accordionStyle: {
      background: 'transparent',
    },

    gridRootStyle: {
      width: '100%',
    },

    cardStyles: {
      paddingLeft: '10px',
      paddingRight: '10px',
    },
  }),
);

const BasicCard = ({ children }: { children: ReactNode }) => (
  <InfoCard title="PagerDuty">{children}</InfoCard>
);

/** @public */
export type PagerDutyCardProps = PagerDutyEntity & {
  entity: Entity;
  readOnly?: boolean;
  disableInsights?: boolean;
  disableOnCall?: boolean;
};

/** @public */
export const PagerDutySmallCard = (props: PagerDutyCardProps) => {
  const classes = useStyles();

  const theme = useTheme();
  const { entity, readOnly, disableInsights, disableOnCall } = props;
  const api = useApi(pagerDutyApiRef);
  const [refreshStatus, setRefreshStatus] = useState<boolean>(false);

  const handleRefresh = useCallback(() => {
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
      name: foundService.name,
      account: props.account,
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
        errorNode = <ServiceNotFoundError entity={entity} />;
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
    <Card data-testid="pagerduty-card" className={classes.cardStyles}>
      <CardHeader
        title={
          theme.palette.type === 'dark' ? (
            <img src={PDWhiteImage} alt="PagerDuty" height="25" />
          ) : (
            <img src={PDGreenImage} alt="PagerDuty" height="25" />
          )
        }
        action={
          !readOnly && props.integrationKey ? (
            <Flex>
              <TriggerIncidentButton
                compact
                data-testid="trigger-incident-button"
                integrationKey={props.integrationKey}
                entityName={props.name}
                handleRefresh={handleRefresh}
              />
              <OpenServiceButton compact serviceUrl={service!.url} />
            </Flex>
          ) : (
            <OpenServiceButton compact serviceUrl={service!.url} />
          )
        }
      />

      <Grid.Root columns="2" gap="1" pl="1" pr="1">
        <Grid.Item>
          <Text weight="bold" color="secondary">STATUS</Text>
        </Grid.Item>

        <Grid.Item>
          <Text weight="bold" color="secondary">STANDARDS</Text>
        </Grid.Item>
      </Grid.Root>

      <Grid.Root columns="2" gap="1" pl="1" pr="1">
        <Grid.Item>
          <StatusCard
            compact
            serviceId={service!.id}
            refreshStatus={refreshStatus}
            account={service!.account}
          />
        </Grid.Item>
        <Grid.Item>
          <ServiceStandardsCard
            compact
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

      {disableInsights !== true ? (
        <Accordion className={classes.accordionStyle}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1a-content"
            id="panel1a-header"
          >
            <Text weight="bold" color="secondary">INSIGHTS</Text>
            <Text weight="bold" color="secondary" className={classes.subheaderTextStyle}>(last 30 days)</Text>
          </AccordionSummary>

          <AccordionDetails>
            <Grid.Root
              columns="3"
              gap="1"
              pl="1"
              pr="1"
              className={classes.gridRootStyle}
            >
              <Grid.Item>
                <InsightsCard
                  compact
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
                  compact
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
                  compact
                  count={
                    service?.metrics !== undefined &&
                    service?.metrics?.length > 0
                      ? service?.metrics[0].total_incident_count
                      : undefined
                  }
                  label="incidents"
                  color={theme.palette.error.main}
                />
              </Grid.Item>
            </Grid.Root>
          </AccordionDetails>
        </Accordion>
      ) : (
        <></>
      )}

      {disableOnCall !== true ? (
        <Accordion className={classes.accordionStyle}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1a-content"
            id="panel1a-header"
          >
            <Text weight="bold" color="secondary">ON CALL</Text>
          </AccordionSummary>

          <AccordionDetails>
            <EscalationPolicy
              data-testid="oncall-card"
              policyId={service!.policyId}
              policyUrl={service!.policyLink}
              policyName={service!.policyName}
              account={service!.account}
            />
          </AccordionDetails>
        </Accordion>
      ) : (
        <></>
      )}
    </Card>
  );
};
