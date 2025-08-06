// Test file to check imports
import {
  PagerDutyEntityMapping,
  PagerDutySetting,
  PagerDutyService,
} from '@pagerduty/backstage-plugin-common';

// This should work if the types are properly exported
const testMapping: PagerDutyEntityMapping = {
  entityRef: 'test',
  serviceId: 'test',
};

console.log('Import test successful');
