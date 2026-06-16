import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { rootRouteRef } from '../routes';
import { PageBlueprint } from '@backstage/frontend-plugin-api';
import { PagerDutyIcon } from '../components';

/** @alpha */
export const pagerDutyPage = PageBlueprint.make({
  params: {
    path: '/pagerduty',
    title: 'PagerDuty',
    icon: <PagerDutyIcon />,
    routeRef: convertLegacyRouteRef(rootRouteRef),
    loader: () =>
      import('../components/PagerDutyPage').then(m => <m.PagerDutyPage />),
  }
});
