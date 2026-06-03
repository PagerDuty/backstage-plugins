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

import {
  PagerDutyChangeEventsResponse,
  PagerDutyServiceResponse,
  PagerDutyUser,
  PagerDutyIncidentsResponse,
  PagerDutyServiceStandardsResponse,
  PagerDutyServiceMetricsResponse,
  PagerDutyServiceStandards,
  PagerDutyServiceMetrics,
  PagerDutySetting,
  PagerDutyService,
  PagerDutyTeam,
  PagerDutyEnhancedEntityMappingsResponse,
  AutoMatchStartResponse,
  AutoMatchStatusResponse,
  BackstageCustomField,
  BackstageCustomFieldCreateRequest,
  BackstageCustomFieldUpdateRequest,
  BackstageCustomFieldsResponse,
  CustomFieldSyncLogsResponse,
  CustomFieldSyncLogFilters,
} from '@pagerduty/backstage-plugin-common';
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { PagerDutyEntity } from '../types';

/** @public */
export type PagerDutyTriggerAlarmRequest = {
  integrationKey: string;
  source: string;
  description: string;
  userName: string;
};

/** @public */
export type PagerDutyCardServiceResponse = {
  id: string;
  name: string;
  url: string;
  policyId: string;
  policyLink: string;
  policyName: string;
  status?: string;
  account?: string;
  standards?: PagerDutyServiceStandards;
  metrics?: PagerDutyServiceMetrics[];
};

/** @public */
export interface PagerDutyApi {
  /**
   * Fetches PagerDuty setting from store.
   *
   */
  getSetting(id: string): Promise<PagerDutySetting>;
  /**
   * Stores PagerDuty setting in the database.
   *
   */
  storeSettings(settings: PagerDutySetting[]): Promise<Response>;
  /**
   * Fetches entity mappings with pagination and search support.
   *
   */
  getEntityMappingsWithPagination(options: {
    offset: number;
    limit: number;
    filters?: {
      name?: string;
      serviceName?: string;
      status?: string;
      teamName?: string;
    };
    sort?: { column: string; direction: 'ascending' | 'descending' };
    account?: string;
  }): Promise<PagerDutyEnhancedEntityMappingsResponse>;

  /**
   * Stores the service mapping in the database.
   *
   */
  storeServiceMapping(
    serviceId: string,
    integrationKey: string,
    entityRef: string,
    account: string,
  ): Promise<Response>;

  /**
   * Fetches the service mapping for a specific entity.
   *
   */
  getEntityMapping(entityRef: string): Promise<{
    mapping: {
      serviceId: string;
      integrationKey: string;
      entityRef: string;
      account: string;
    };
  }>;

  /**
   * Removes the service mapping for an entity by setting entityRef to empty string.
   * Uses the same approach as the admin page "None" option.
   *
   */
  removeServiceMapping(entityRef: string): Promise<boolean>;
  
  /**  
  * Stores multiple service mappings in the database.
  *
  */
  storeBulkServiceMappings(mappings: Array<{
    serviceId: string;
    integrationKey: string;
    entityRef: string;
    account: string;
  }>): Promise<Response>;

  /**
   * Fetches the service for the provided pager duty Entity.
   *
   */
  getServiceByPagerDutyEntity(
    pagerDutyEntity: PagerDutyEntity,
  ): Promise<PagerDutyServiceResponse>;

  /**
   * Fetches the service for the provided Entity.
   *
   */
  getServiceByEntity(entity: Entity): Promise<PagerDutyServiceResponse>;

  /**
   * Fetches service with the provided service id.
   *
   */
  getServiceById(
    serviceId: string,
    account?: string,
  ): Promise<PagerDutyServiceResponse>;

  /**
   * Fetches a list of incidents a provided service has.
   *
   */
  getIncidentsByServiceId(
    serviceId: string,
    account?: string,
  ): Promise<PagerDutyIncidentsResponse>;

  /**
   * Fetches a list of change events a provided service has.
   *
   */
  getChangeEventsByServiceId(
    serviceId: string,
    account?: string,
  ): Promise<PagerDutyChangeEventsResponse>;

  /**
   * Fetches a list of PagerDuty services.
   *
   */
  getAllServices(): Promise<PagerDutyService[]>;

  /**
   * Fetches a list of PagerDuty teams.
   *
   * @param account - The account ID to filter teams by
   */
  getAllTeams(account?: string): Promise<PagerDutyTeam[]>;

  /**
   * Fetches a filtered list of PagerDuty services.
   *
   * @param teamIds - Optional array of team IDs to filter by
   * @param query - Optional search query for service name or ID
   * @param limit - Optional maximum number of results (default: 100)
   * @param account - The account ID to filter services by
   */
  getFilteredServices(
    teamIds?: string[],
    query?: string,
    limit?: number,
    account?: string,
  ): Promise<PagerDutyService[]>;

  /**
   * Fetches a list of standards for a provided service.
   *
   */
  getServiceStandardsByServiceId(
    serviceId: string,
    account?: string,
  ): Promise<PagerDutyServiceStandardsResponse>;

  /**
   * Fetches a list of metrics for a provided service.
   *
   */
  getServiceMetricsByServiceId(
    serviceId: string,
    account?: string,
  ): Promise<PagerDutyServiceMetricsResponse>;

  /**
   * Fetches the list of users in an escalation policy.
   *
   */
  getOnCallByPolicyId(
    policyId: string,
    account?: string,
  ): Promise<PagerDutyUser[]>;

  /**
   * Triggers an incident to whoever is on-call.
   */
  triggerAlarm(request: PagerDutyTriggerAlarmRequest): Promise<Response>;

  /**
   * Starts an async auto-match job and returns a jobId to poll.
   */
  startAutoMatchEntityMappings(options: {
    team?: string;
    threshold: number;
    account?: string;
  }): Promise<AutoMatchStartResponse>;

  /**
   * Fetches the current status (and result, when complete) of an auto-match job.
   */
  getAutoMatchStatus(jobId: string): Promise<AutoMatchStatusResponse>;

  /**
   * Fetches the list of configured PagerDuty accounts.
   */
  getAccounts(): Promise<Array<{ id: string; isDefault: boolean }>>;

  /**
   * Creates a custom field in PagerDuty and stores the mapping.
   */
  createCustomField(
    request: BackstageCustomFieldCreateRequest,
    account?: string,
  ): Promise<Result<BackstageCustomField>>;

  /**
   * Fetches all custom fields.
   */
  getCustomFields(account?: string): Promise<BackstageCustomFieldsResponse>;

  /**
   * Updates an existing custom field mapping.
   */
  updateCustomField(
    id: number,
    request: BackstageCustomFieldUpdateRequest,
    account?: string,
  ): Promise<Result<BackstageCustomField>>;

  /**
   * Fetches sync logs (paginated, filtered) along with the distinct
   * filter values for the given account.
   */
  getSyncLogs(
    account?: string,
    options?: { limit?: number; offset?: number } & CustomFieldSyncLogFilters,
  ): Promise<CustomFieldSyncLogsResponse>;
}

/** @public */
export type PagerDutyClientApiDependencies = {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
};

/** @public */
export type PagerDutyClientApiConfig = PagerDutyClientApiDependencies & {
  eventsBaseUrl?: string;
};

export type RequestOptions = {
  method: string;
  headers: HeadersInit;
  body?: BodyInit;
};

/** @public */
export type Result<T> =
  | { status: 'ok'; data: T; error: null }
  | { status: 'error'; data: null; error: string };
