import { Header, Page, Content } from '@backstage/core-components';
import { ServiceMappingPage } from './ServiceMappingPage';

/** @public */
export const PagerDutyPage = () => (
  <Page themeId="home">
    <Header title="PagerDuty" subtitle="Advanced configurations" />
    <Content>
      <ServiceMappingPage />
    </Content>
  </Page>
);
