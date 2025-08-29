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
import { useEffect } from 'react';
import { createStyles, List, makeStyles } from '@material-ui/core';
import { IncidentListItem } from './IncidentListItem';
import { IncidentsEmptyState } from './IncidentEmptyState';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { pagerDutyApiRef } from '../../api';
import { Alert } from '@material-ui/lab';

import { useApi } from '@backstage/core-plugin-api';
import { Progress } from '@backstage/core-components';
import { IncidentForbiddenState } from './IncidentForbiddenState';
import { BackstageTheme } from '@backstage/theme';

type Props = {
  serviceId: string;
  account?: string;
  refreshIncidents: boolean;
};

const useStyles = makeStyles<BackstageTheme>(() =>
  createStyles({
    loadingStyles: {
      height: '253px',
    },
  }),
);

export const Incidents = ({ serviceId, account, refreshIncidents }: Props) => {
  const api = useApi(pagerDutyApiRef);
  const { loadingStyles } = useStyles();

  const [{ value: incidents, loading, error }, getIncidents] = useAsyncFn(
    async () => {
      const { incidents: foundIncidents } = await api.getIncidentsByServiceId(
        serviceId,
        account,
      );
      return foundIncidents;
    },
  );

  useEffect(() => {
    getIncidents();
  }, [refreshIncidents, getIncidents]);

  if (error) {
    if (error.message.includes('Forbidden')) {
      return <IncidentForbiddenState />;
    }

    return (
      <Alert severity="error">
        Error encountered while fetching information. {error.message}
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className={loadingStyles}>
        <Progress />
      </div>
    );
  }

  if (!incidents?.length) {
    return <IncidentsEmptyState />;
  }

  return (
    <List dense>
      {incidents!.map((incident, index) => (
        <IncidentListItem key={incident.id + index} incident={incident} />
      ))}
    </List>
  );
};
