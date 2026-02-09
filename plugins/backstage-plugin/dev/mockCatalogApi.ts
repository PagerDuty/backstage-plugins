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
    // Groups
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        name: 'guests',
        description: 'Guest Team',
      },
      spec: {
        type: 'team',
        children: [],
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        name: 'platform-team',
        description: 'Platform Team',
      },
      spec: {
        type: 'team',
        children: [],
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        name: 'infrastructure-team',
        description: 'Infrastructure Team',
      },
      spec: {
        type: 'team',
        children: [],
      },
    },
    // Components
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'example-website',
        annotations: {
          'pagerduty.com/service-id': 'P6V1UFE',
        },
      },
      spec: {
        type: 'website',
        lifecycle: 'experimental',
        owner: 'guests',
        system: 'examples',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'second-service',
      },
      spec: {
        type: 'website',
        lifecycle: 'experimental',
        owner: 'platform-team',
        system: 'examples',
      },
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test-service',
      },
      spec: {
        type: 'website',
        lifecycle: 'experimental',
        owner: 'infrastructure-team',
        system: 'examples',
      },
    },
  ],
});
