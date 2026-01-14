import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import * as api from '../apis/pagerduty';
import { CreateServiceResponse } from '../types';
import { loadAuthConfig } from '../auth/auth';
import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { loadBackendConfig } from '@backstage/backend-common';
import {
  loadPagerDutyEndpointsFromConfig,
  getAccountByEscalationPolicyId,
} from '../apis/pagerduty';

export type CreatePagerDutyServiceActionProps = {
  config: RootConfigService;
  logger: LoggerService;
};

export const createPagerDutyServiceAction = (props?: CreatePagerDutyServiceActionProps) => {
  let loggerService: LoggerService;

  return createTemplateAction({
    id: 'pagerduty:service:create',
    description: 'Creates a new PagerDuty service with Backstage integration',
    schema: {
      input: {
        name: z => z.string().min(1, 'name is required').describe('Name of the service'),
        description: z => z
          .string()
          .min(1, 'description is required')
          .describe('Description of the service'),
        escalationPolicyId: z => z
          .string()
          .min(1, 'Escalation policy is required')
          .describe('Escalation policy ID'),
        alertGrouping: z => z.string().optional().describe('Alert grouping parameters'),
      },
      output: {
        account: z => z.string().describe('PagerDuty Account'),
        serviceUrl: z => z.string().describe('PagerDuty Service URL'),
        serviceId: z => z.string().describe('PagerDuty Service ID'),
        integrationKey: z => z.string().describe('Backstage Integration Key'),
      },
    },

    async handler(ctx) {
      try {
        loggerService = props?.logger ? props.logger : ctx.logger;
        const configService = props?.config;

        const legacyConfig: Config = await loadBackendConfig({
          logger: loggerService,
          argv: [],
        });

        // Load the auth configuration
        await loadAuthConfig({
          config: configService,
          legacyConfig: legacyConfig,
          logger: loggerService,
        });

        // Load endpoint configuration
        loadPagerDutyEndpointsFromConfig({
          config: configService,
          legacyConfig: legacyConfig,
          logger: loggerService,
        });

        const account: string = await getAccountByEscalationPolicyId(
          ctx.input.escalationPolicyId,
        );

        // Create service in PagerDuty
        loggerService.info(
          `Creating service '${ctx.input.name}' in account '${account}'.`,
        );
        const service: CreateServiceResponse = await api.createService({
          name: ctx.input.name,
          description: ctx.input.description,
          escalationPolicyId: ctx.input.escalationPolicyId,
          account: account,
          alertGrouping: ctx.input.alertGrouping,
        });
        loggerService.info(`Service '${ctx.input.name}' created successfully!`);
        loggerService.info(`Alert grouping set to '${service.alertGrouping}'`);

        ctx.output('serviceUrl', service.url);
        ctx.output('serviceId', service.id);
        ctx.output('account', account);

        // Create Backstage Integration in PagerDuty service
        const backstageIntegrationId = 'PRO19CT'; // ID for Backstage integration

        loggerService.info(
          `Creating Backstage Integration for service '${ctx.input.name}' in account '${account}'.`,
        );

        const integrationKey = await api.createServiceIntegration({
          serviceId: service.id,
          vendorId: backstageIntegrationId,
          account,
        });
        loggerService.info(
          `Backstage Integration for service '${ctx.input.name}' created successfully!`,
        );

        ctx.output('integrationKey', integrationKey);
      } catch (error) {
        loggerService.error(`${error}`);
      }
    },
  });
};
