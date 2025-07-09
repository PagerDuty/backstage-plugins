import {
    createServiceBuilder,
    DatabaseManager,
    HostDiscovery,
    loadBackendConfig,
} from '@backstage/backend-common';
import { ConfigReader } from '@backstage/config';
import { Server } from 'http';
import { createRouter } from './router';
import { LoggerService } from '@backstage/backend-plugin-api';
import { PagerDutyBackendDatabase } from '../db';
import { PagerDutyBackendStore } from '../db/PagerDutyBackendDatabase';

export interface ServerOptions {
    port: number;
    enableCors: boolean;
    logger: LoggerService;
}

export async function startStandaloneServer(
    options: ServerOptions,
): Promise<Server> {
    const logger = options.logger.child({ service: 'pagerduty-backend' });
    const config = await loadBackendConfig({ logger, argv: process.argv });

    const manager = DatabaseManager.fromConfig(
        new ConfigReader({
            backend: {
                database: { client: 'better-sqlite3', connection: ':memory:' },
            },
        }),
    );
    const database = manager.forPlugin('pagerduty');

    const store : PagerDutyBackendStore = await PagerDutyBackendDatabase.create(await database.getClient(), { skipMigrations: true });

    const discovery = HostDiscovery.fromConfig(config);


    logger.debug('Starting application server...');
    const router = await createRouter({
        config,
        logger,
        store,
        discovery
    });

    let service = createServiceBuilder(module)
        .setPort(options.port)
        .addRouter('/pagerduty', router);
    if (options.enableCors) {
        service = service.enableCors({ origin: 'http://localhost:3000' });
    }

    return service.start().catch(err => {
        logger.error(err);
        process.exit(1);
    });
}

module.hot?.accept();