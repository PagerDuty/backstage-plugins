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

import {
  PagerDutyAccountConfig,
  PagerDutyOAuthConfig,
} from '@pagerduty/backstage-plugin-common';

export interface Config {
  /**
   * Configuration for the PagerDuty plugin
   * @visibility frontend
   */
  pagerDuty?: {
    /**
     * Optional Events Base URL to override the default.
     * @visibility frontend
     */
    eventsBaseUrl?: string;
    /**
     * Optional API Base URL to override the default.
     * @visibility frontend
     */
    apiBaseUrl?: string;
    /**
     * Optional PagerDuty API Token used in API calls from the backend component.
     * @visibility secret
     */
    apiToken?: string;
    /**
     * Optional PagerDuty Scoped OAuth Token used in API calls from the backend component.
     * @deepVisibility secret
     */
    oauth?: PagerDutyOAuthConfig;
    /**
     * Optional PagerDuty multi-account configuration
     * @deepVisibility secret
     */
    accounts?: PagerDutyAccountConfig[];
    /**
     * Optional retention and cleanup settings for custom field sync logs.
     * @visibility backend
     */
    customFieldsSyncLogs?: {
      /**
       * Number of days to keep sync logs before they are deleted. Defaults to 30.
       * @visibility backend
       */
      retentionDays?: number;
      /**
       * Maximum number of sync log rows to keep across all accounts; the
       * oldest rows beyond this count are deleted. Defaults to 500000.
       * @visibility backend
       */
      maxRows?: number;
      /**
       * Settings for the scheduled cleanup task.
       * @visibility backend
       */
      cleanup?: {
        /**
         * Whether the scheduled cleanup task runs. Defaults to true.
         * @visibility backend
         */
        enabled?: boolean;
        /**
         * How often the cleanup task runs, in minutes. Defaults to 15.
         * @visibility backend
         */
        frequencyMinutes?: number;
        /**
         * Number of rows deleted per batch. Defaults to 10000.
         * @visibility backend
         */
        batchSize?: number;
        /**
         * Maximum number of delete batches per run. Defaults to 500.
         * @visibility backend
         */
        maxBatchesPerRun?: number;
      };
    };
  };
}
