---
'@pagerduty/backstage-plugin-backend': patch
'@pagerduty/backstage-plugin-entity-processor': patch
---

Fix the `/catalog/entity/:type/:namespace/:name` lookup used for service dependencies. The route now sends an empty string when the entity has no `pagerduty.com/service-id` annotation and a JSON 404 body when the entity is missing, and the entity processor reads the response status before parsing the body, so a dependency without a service id no longer throws `Unexpected end of JSON input`.
