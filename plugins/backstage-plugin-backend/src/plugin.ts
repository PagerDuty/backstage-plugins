import {
  AuthService,
  LoggerService,
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';
import { PagerDutyBackendDatabase, PagerDutyBackendStore } from './db';
import { CatalogClient } from '@backstage/catalog-client';

class CatalogFetchApi {
  constructor(
    private readonly logger: LoggerService,
    private readonly auth: AuthService,
  ) { }

  async fetch(
    input: unknown,
    init: RequestInit | undefined,
  ): Promise<Response> {
    const request = new Request(input as RequestInfo | URL, init);
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    request.headers.set('Authorization', `Bearer ${token}`);
    this.logger.debug(`Added token to outgoing request to ${request.url}`);
    return fetch(request);
  }
}

/** @public */
export const pagerDutyPlugin = createBackendPlugin({
  pluginId: 'pagerduty',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ config, logger, httpRouter, database, discovery, auth }) {
        const pagerDutyBackendStore: PagerDutyBackendStore =
          await PagerDutyBackendDatabase.create(await database.getClient(), {
            skipMigrations: false,
          });

        httpRouter.use(
          await createRouter({
            config,
            logger,
            store: pagerDutyBackendStore,
            discovery,
            auth,
            catalogApi: new CatalogClient({
              discoveryApi: discovery,
              fetchApi: new CatalogFetchApi(logger, auth),
            }),
          }),
        );
        // The default Backstage behaviour is to require authentication on routes.
        // https://backstage.io/docs/backend-system/core-services/http-router/#using-the-service
        // Setting disableUnauthenticatedAccess to true will revert this plugin's route authentication
        // policy back to the default Backstage behaviour.
        const disableUnauthenticatedAccess = config.getOptionalBoolean('pagerDuty.disableUnauthenticatedAccess') ?? false;
        if (!disableUnauthenticatedAccess) {
          httpRouter.addAuthPolicy({
            path: '/',
            allow: 'unauthenticated',
          });
        }
      },
    });
  },
});
