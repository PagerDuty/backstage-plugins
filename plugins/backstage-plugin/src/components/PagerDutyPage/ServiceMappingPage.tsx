import { Alert, Box } from '@backstage/ui';
import { ServiceMappingComponent } from './ServiceMappingComponent';

/** @public */
export const ServiceMappingPage = () => {
  return (
    <Box pl="20px" pr="20px">
      <Alert
        status="info"
        icon
        title="Easily map your existing PagerDuty services to entities in Backstage without the need to add anotations to all your projects."
        description="Warning: Only 1:1 mapping is allowed at this time."
        style={{marginBottom: '8px'}}
      />

      <ServiceMappingComponent />
    </Box>
  );
};
