import { compatWrapper } from '@backstage/core-compat-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import {
  PAGERDUTY_INTEGRATION_KEY,
  PAGERDUTY_SERVICE_ID,
} from '../components/constants';

/** @alpha */
export const pagerDutyEntityCard = EntityCardBlueprint.makeWithOverrides({
  config: {
    schema: {
      readOnly: z => z.boolean().optional(),
      disableOnCall: z => z.boolean().optional(),
      disableChangeEvents: z => z.boolean().optional(),
    },
  },
  factory(originalFactory, { config }) {
    return originalFactory({
      filter: {
        [`metadata.annotations.${PAGERDUTY_INTEGRATION_KEY}`]: {
          $exists: true,
        },
      },
      async loader() {
        const { EntityPagerDutyCard } = await import(
          '../components/EntityPagerDutyCard'
        );
        return compatWrapper(
          <EntityPagerDutyCard
            readOnly={config.readOnly}
            disableOnCall={config.disableOnCall}
            disableChangeEvents={config.disableChangeEvents}
          />,
        );
      },
    });
  },
});

/** @alpha */
export const pagerDutyEntitySmallCard = EntityCardBlueprint.makeWithOverrides({
  name: 'small',
  disabled: true,
  config: {
    schema: {
      readOnly: z => z.boolean().optional(),
      disableOnCall: z => z.boolean().optional(),
      disableInsights: z => z.boolean().optional(),
    },
  },
  factory(originalFactory, { config }) {
    return originalFactory({
      filter: {
        [`metadata.annotations.${PAGERDUTY_SERVICE_ID}`]: { $exists: true },
      },
      async loader() {
        const { EntityPagerDutySmallCard } = await import(
          '../components/EntityPagerDutySmallCard'
        );
        return compatWrapper(
          <EntityPagerDutySmallCard
            readOnly={config.readOnly}
            disableOnCall={config.disableOnCall}
            disableInsights={config.disableInsights}
          />,
        );
      },
    });
  },
});
