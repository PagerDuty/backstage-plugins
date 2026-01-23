/*
 * Copyright 2023 The Backstage Authors
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

import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';

export const mockCatalogApi = catalogApiMock({
  entities: [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'backstage',
        description: 'backstage.io',
        annotations: {
          'github.com/project-slug': 'backstage/backstage',
          'pagerduty.com/service-id': 'foo',
          'pagerduty.com/integration-key': 'foo',
        },
      },
      spec: {
        lifecycle: 'production',
        type: 'website',
        owner: 'user:guest',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'unmapped-service',
        description: 'Service with deleted PagerDuty mapping',
        annotations: {
          'github.com/project-slug': 'backstage/unmapped-service',
          'pagerduty.com/service-id': 'DELETED-SERVICE-ID',
          'pagerduty.com/integration-key': 'deleted-integration-key',
        },
      },
      spec: {
        lifecycle: 'production',
        type: 'service',
        owner: 'user:guest',
      },
    },
  ],
});
