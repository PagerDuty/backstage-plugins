import { PageBlueprint } from '@backstage/frontend-plugin-api';
import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { rootRouteRef } from '../routes';

/** @alpha */
export const pagerDutyPage = PageBlueprint.make({
  params: {
    path: '/pagerduty',
    routeRef: convertLegacyRouteRef(rootRouteRef),
    loader: () =>
      import('../components/PagerDutyPage').then(m => <m.PagerDutyPage />),
  },
});
