import { NavItemBlueprint } from '@backstage/frontend-plugin-api';
import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { rootRouteRef } from '../routes';
import { PagerDutyIcon } from '../components';

export const pagerDutyNavItem = NavItemBlueprint.make({
  params: {
    title: 'PagerDuty',
    routeRef: convertLegacyRouteRef(rootRouteRef),
    icon: PagerDutyIcon,
  },
});
