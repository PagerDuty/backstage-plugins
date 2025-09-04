import { rootRouteRef } from '../routes';

import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { convertLegacyRouteRefs } from '@backstage/core-compat-api';

import { pagerDutyApi } from './apis';
import { pagerDutyPage } from './pages';
import { pagerDutyNavItem } from './navItems';
import { pagerDutyEntityCard, pagerDutyEntitySmallCard } from './entityCards';

/** @alpha */
export const pagerDutyPlugin = createFrontendPlugin({
  pluginId: 'pagerduty',
  info: { packageJson: () => import('../../package.json') },
  routes: convertLegacyRouteRefs({
    root: rootRouteRef,
  }),
  extensions: [
    pagerDutyApi,
    pagerDutyPage,
    pagerDutyNavItem,
    pagerDutyEntityCard,
    pagerDutyEntitySmallCard,
  ],
});
