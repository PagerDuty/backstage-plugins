import { compatWrapper } from '@backstage/core-compat-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { z } from 'zod';
import { PAGERDUTY_INTEGRATION_KEY, PAGERDUTY_SERVICE_ID } from '../components/constants';

/** @alpha */
export const pagerDutyEntityCard = EntityCardBlueprint.makeWithOverrides({
  name: 'EntityPagerDutyCard',
  configSchema: {
    readOnly: z.boolean().optional(),
    disableChangeEvents: z.boolean().optional(),
    disableOnCall: z.boolean().optional(),
  },
  factory(originalFactory, { config }) {
    return originalFactory({
      filter: entity => Boolean(
        entity.metadata?.annotations?.[PAGERDUTY_INTEGRATION_KEY] || 
        entity.metadata?.annotations?.[PAGERDUTY_SERVICE_ID]
      ),
      async loader() {
        const { EntityPagerDutyCard } = await import('../components/EntityPagerDutyCard');

        return compatWrapper(
          <EntityPagerDutyCard 
            readOnly={config.readOnly} 
            disableChangeEvents={config.disableChangeEvents}
            disableOnCall={config.disableOnCall}
          />
        );
      }
    })
  }
});

/** @alpha */
export const pagerDutyEntitySmallCard = EntityCardBlueprint.makeWithOverrides({
  name: 'EntityPagerDutySmallCard',
  disabled: true,
  configSchema: {
    readOnly: z.boolean().optional(),
    disableOnCall: z.boolean().optional(),
    disableInsights: z.boolean().optional(),
  },
  factory(originalFactory, { config }) {
    return originalFactory({
      filter: entity => Boolean(
        entity.metadata?.annotations?.[PAGERDUTY_INTEGRATION_KEY] || 
        entity.metadata?.annotations?.[PAGERDUTY_SERVICE_ID]
      ),
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
