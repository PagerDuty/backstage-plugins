---
'@pagerduty/backstage-plugin-scaffolder-actions': minor
'@pagerduty/backstage-plugin-backend': minor
---

Remove deprecated @backstage/backend-common library. This is a potential breaking change for users who are still on the old backend system:
- `createPagerDutyServiceAction(...)` now requires its `config` prop.
- `createRouter(...)` now requires its `auth` prop.

Note that none of this is breaking for users of the new backend system.
