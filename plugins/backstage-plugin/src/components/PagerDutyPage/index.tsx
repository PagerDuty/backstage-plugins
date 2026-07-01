import { Header, Page, Content, TabbedLayout } from '@backstage/core-components';
import { ServiceMappingPage } from './ServiceMappingPage';
import { CustomFields } from './CustomFields';
import { ConfigurationPage } from './ConfigurationPage';

/** @public */
export const PagerDutyPage = () => (
  <Page themeId="home">
    <Header title="PagerDuty" subtitle="Advanced configurations" />
    <Content>
      <TabbedLayout>
        <TabbedLayout.Route path="/service-mapping" title="Service Mapping">
          <ServiceMappingPage />
        </TabbedLayout.Route>
        <TabbedLayout.Route path="/custom-fields" title="Custom Fields">
          <CustomFields />
        </TabbedLayout.Route>
        <TabbedLayout.Route path="/settings" title="Configuration">
          <ConfigurationPage />
        </TabbedLayout.Route>
      </TabbedLayout>
    </Content>
  </Page>
);
