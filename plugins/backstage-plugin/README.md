# PagerDuty Backstage Plugin

> The PagerDuty plugin reduces the cognitive load on developers responsible for maintaining services in production.
Instead of having to go to PagerDuty's console, you can now access the necessary information directly within Backstage.
This includes finding active incidents or opening a new incident, reviewing recent changes made to the service,
and checking who is on-call.

## New Frontend System (NFS)

This frontend plugin is starting the adoption of the [New Frontend System](https://backstage.io/docs/frontend-system/). This allow us to be present in Portal and keep up to date with Backstage's recommended best practices.

### Migration

We're still migrating to the NFS, since it is still in alpha. You can find this version of the plugin on the export `@pagerduty/backstage-plugin/alpha`, which allows you to start using it even in Backstage under the new `createApp` helper from `@backstage/frontend-defaults`.

### Extensions

The NFS allows for extendable plugins, which means there are parts of it that users can replace to elevate their experience. We've historically exported two components the `EntityPagerDutyCard` and the `EntityPagerDutySmallCard` to expose some PagerDuty's service information on your Backstage entities. In the NFS, we default to `EntityPagerDutyCard` as an entity card extension, which means you can still make use of the `EntityPagerDutySmallCard` through overrides.

```javascript
import PagerDutyPlugin from '@pagerduty/backstage-plugin/alpha';
import { EntityPagerDutySmallCard } from '@pagerduty/backstage-plugin';

const OverriddenPagerDutyPlugin = PagerDutyPlugin.withOverrides({
  extensions: [
    PagerDutyPlugin.getExtension('entity-card:pagerduty/EntityPagerDutyCard').override({
      factory: originalFactory => 
        originalFactory({
          params: {
            loader: async () => Promise.resolve(<EntityPagerDutySmallCard />)
          }
        })
    })
  ]
})
```
