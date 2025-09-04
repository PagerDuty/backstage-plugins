import ApiExplorerPlugin from '@backstage/plugin-api-docs/alpha';
import ApiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import CatalogPlugin from '@backstage/plugin-catalog/alpha';
import CatalogImportPlugin from '@backstage/plugin-catalog-import/alpha';
import ScaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import OrgPlugin from '@backstage/plugin-org/alpha';
import SearchPlugin from '@backstage/plugin-search/alpha';
import TechDocsPlugin from '@backstage/plugin-techdocs/alpha';
import { createApp } from '@backstage/frontend-defaults';
import PagerDutyPlugin from '@pagerduty/backstage-plugin/alpha';

// Uncomment the line below if you want to use the overridden version of PagerDuty plugin
// import { EntityPagerDutySmallCard } from '@pagerduty/backstage-plugin';

// const OverriddenPagerDutyPlugin = PagerDutyPlugin.withOverrides({
//   extensions: [
//     PagerDutyPlugin.getExtension('entity-card:pagerduty/EntityPagerDutyCard').override({
//       factory: originalFactory =>
//         originalFactory({
//           params: {
//             loader: async () => Promise.resolve(<EntityPagerDutySmallCard />)
//           }
//         })
//     })
//   ]
// })

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
    PagerDutyPlugin,
    // Uncomment the line below if you want to use the overridden version of PagerDuty plugin
    // OverriddenPagerDutyPlugin
  ],
});

export default app.createRoot();
