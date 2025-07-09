import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createPagerDutyServiceAction } from './actions/custom';

/** @public */
export const pagerDutyScaffolderActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'pagerduty-actions',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ config, logger, scaffolder }) {
        scaffolder.addActions(
          createPagerDutyServiceAction({
            config,
            logger,
          }),
        );
      },
    });
  },
});
