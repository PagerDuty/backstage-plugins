import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
export type CreatePagerDutyServiceActionProps = {
    config: RootConfigService;
    logger: LoggerService;
};
export declare const createPagerDutyServiceAction: (props?: CreatePagerDutyServiceActionProps) => import("@backstage/plugin-scaffolder-node").TemplateAction<{
    name: string;
    description: string;
    escalationPolicyId: string;
    alertGrouping?: string;
}, import("@backstage/types/index").JsonObject>;
