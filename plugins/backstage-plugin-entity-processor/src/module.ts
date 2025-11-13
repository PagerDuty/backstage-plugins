import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { PagerDutyEntityProcessor } from './processor';

/** @public */
export const pagerDutyEntityProcessor = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'pagerduty-entity-processor',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        catalog: catalogProcessingExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ auth, logger, discovery, catalog }) {
        catalog.addProcessor(
          new PagerDutyEntityProcessor({ auth, logger, discovery }),
        );
      },
    });
  },
});
