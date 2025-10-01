import ApiExplorerPlugin from '@backstage/plugin-api-docs/alpha';
import ApiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import CatalogPlugin from '@backstage/plugin-catalog/alpha';
import CatalogImportPlugin from '@backstage/plugin-catalog-import/alpha';
import ScaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import OrgPlugin from '@backstage/plugin-org/alpha';
import SearchPlugin from '@backstage/plugin-search/alpha';
import TechDocsPlugin from '@backstage/plugin-techdocs/alpha';
import { createApp } from '@backstage/frontend-defaults';
import pagerDutyPlugin from '@pagerduty/backstage-plugin/alpha';

const app = createApp({
  features: [
    ApiExplorerPlugin,
    ApiDocsPlugin,
    CatalogPlugin,
    CatalogImportPlugin,
    ScaffolderPlugin,
    SearchPlugin,
    OrgPlugin,
    TechDocsPlugin,
    pagerDutyPlugin,
  ],
});

export default app.createRoot();
