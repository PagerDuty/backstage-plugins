import {
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { createGetOnCallInformationAction } from './createGetOnCallInformationAction';

export { PagerDutyClient } from './PagerDutyClient';

export const createPagerdutyActions = (options: {
  actionsRegistry: ActionsRegistryService;
  discovery: DiscoveryService;
  auth: AuthService;
}) => {
  createGetOnCallInformationAction(options);
};
