---
'@pagerduty/backstage-plugin': minor
---

Add capability to unmap PagerDuty service mappings when service is deleted or recreated. Fixes issue where Backstage services mapped to deleted PagerDuty services cannot be remapped to new services. Includes an "Unmap Service" button in the ServiceNotFoundError component to clean up stale mappings.
