/*
 * Copyright 2025 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "react";
import { 
  ApiBlueprint, 
  createFrontendPlugin, 
  createRouteRef, 
  FrontendPlugin, 
  PageBlueprint,
  NavItemBlueprint,
  discoveryApiRef,
  configApiRef,
  fetchApiRef,
  ConfigApi,
  DiscoveryApi,
  FetchApi
} from "@backstage/frontend-plugin-api";
import { compatWrapper } from "@backstage/core-compat-api";
import { EntityCardBlueprint } from "@backstage/plugin-catalog-react/alpha"
import { pagerDutyApiRef, PagerDutyClient } from './api';
import { PagerDutyIcon } from './components';

export const rootRouteRef = createRouteRef();

/** @alpha */
const PagerDutyAPI = ApiBlueprint.make({
  params: {
    factory: {
      api: pagerDutyApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        configApi: configApiRef,
        fetchApi: fetchApiRef
      },
      factory: ({ 
        configApi, 
        discoveryApi, 
        fetchApi 
      }: { configApi: ConfigApi; discoveryApi: DiscoveryApi; fetchApi: FetchApi }) =>
        PagerDutyClient.fromConfig(configApi, { discoveryApi, fetchApi }),
    }
  }
});

/** @alpha */
const PagerDutyPage = PageBlueprint.make({
  params: {
    defaultPath: '/pagerduty',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/PagerDutyPage')
        .then(m => compatWrapper(<m.PagerDutyPage />)),
  }
});

/** @alpha */
const EntityPagerDutyCard = EntityCardBlueprint.make({
  name: 'EntityPagerDutyCard',
  params: {
    filter: 'kind:component',
    loader: async () => import('./components/EntityPagerDutyCard') 
      .then(m => compatWrapper(<m.EntityPagerDutyCard />)),
  }
});

/** @alpha */
const PagerDutyNavBarItem = NavItemBlueprint.make({
  name: 'PagerDutyNavBarItem',
  params: {
    title: 'PagerDuty',
    icon: () => <PagerDutyIcon />,
    routeRef: rootRouteRef,
  }
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'pagerduty',
  extensions: [
    EntityPagerDutyCard,
    PagerDutyAPI,
    PagerDutyPage,
    PagerDutyNavBarItem
  ],
  routes: {
    root: rootRouteRef
  }
}) as FrontendPlugin;
