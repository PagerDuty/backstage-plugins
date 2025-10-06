/*
 * Copyright 2020 The Backstage Authors
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

import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { pagerDutyApiRef } from '../src/api';
import { mockPagerDutyApi } from './mockPagerDutyApi';
import '@backstage/ui/css/styles.css';

import ReactDOM from 'react-dom/client';
import { createApp } from '@backstage/frontend-defaults';
import pagerDutyPlugin from '../src/alpha';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { mockCatalogApi } from './mockCatalogApi';

const catalogPluginOverrides = catalogPlugin.withOverrides({
  extensions: [
    catalogPlugin.getExtension('api:catalog').override({
      params: defineParams =>
        defineParams({
          api: catalogApiRef,
          deps: {},
          factory: () => mockCatalogApi
        })
    })
  ]
})

const pagerDutyPluginOverrides = pagerDutyPlugin.withOverrides({
  extensions: [
    pagerDutyPlugin.getExtension('api:pagerduty').override({
      params: defineParams => 
        defineParams({
          api: pagerDutyApiRef,
          deps: {},
          factory: () => mockPagerDutyApi,
        })
    })
  ]
})


const app = createApp({
  features: [catalogPluginOverrides, pagerDutyPluginOverrides],
})

const root = app.createRoot();

ReactDOM.createRoot(document.getElementById('root')!).render(root);
