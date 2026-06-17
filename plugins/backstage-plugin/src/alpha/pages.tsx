import { convertLegacyRouteRef } from '@backstage/core-compat-api';
import { rootRouteRef } from '../routes';
import { PageBlueprint, SubPageBlueprint } from '@backstage/frontend-plugin-api';
import { PagerDutyIcon } from '../components';

/** @alpha */
export const pagerDutyPage = PageBlueprint.make({
  params: {
    path: '/pagerduty',
    title: 'PagerDuty',
    icon: <PagerDutyIcon />,
    routeRef: convertLegacyRouteRef(rootRouteRef),
    // No `loader` here on purpose: when a page has a loader the frontend
    // system renders only that content and ignores the `pages` input. Omitting
    // it makes the attached SubPageBlueprint extensions render as tabs, with
    // the index route redirecting to the first tab (Service Mapping).
  },
});

/** @alpha */
export const pagerDutyServiceMappingSubPage = SubPageBlueprint.make({
  name: 'service-mapping',
  attachTo: { id: 'page:pagerduty', input: 'pages' },
  params: {
    path: 'service-mapping',
    title: 'Service Mapping',
    loader: () =>
      import('../components/PagerDutyPage/ServiceMappingPage').then(m => (
        <m.ServiceMappingPage />
      )),
  },
});

/** @alpha */
export const pagerDutyCustomFieldsSubPage = SubPageBlueprint.make({
  name: 'custom-fields',
  attachTo: { id: 'page:pagerduty', input: 'pages' },
  params: {
    path: 'custom-fields',
    title: 'Custom Fields',
    loader: () =>
      import('../components/PagerDutyPage/CustomFields').then(m => (
        <m.CustomFields />
      )),
  },
});

/** @alpha */
export const pagerDutyConfigurationSubPage = SubPageBlueprint.make({
  name: 'configuration',
  attachTo: { id: 'page:pagerduty', input: 'pages' },
  params: {
    path: 'settings',
    title: 'Configuration',
    loader: () =>
      import('../components/PagerDutyPage/ConfigurationPage').then(m => (
        <m.ConfigurationPage />
      )),
  },
});
