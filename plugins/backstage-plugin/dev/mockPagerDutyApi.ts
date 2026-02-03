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
  PagerDutyApi,
  PagerDutyEntity,
  PagerDutyTriggerAlarmRequest,
} from '../src';
import {
  PagerDutyChangeEvent,
  PagerDutyIncident,
  PagerDutyUser,
  FormattedBackstageEntity,
  PagerDutyEnhancedEntityMappingsResponse,
} from '@pagerduty/backstage-plugin-common';
import { Entity } from '@backstage/catalog-model';
import { v4 as uuidv4 } from 'uuid';

export const mockPagerDutyApi: PagerDutyApi = {
  async getSetting(id: string) {
    return {
      id: id,
      value: 'backstage',
    };
  },
  async storeSettings(settings) {
    return new Response(JSON.stringify(settings));
  },

  async getEntityMappingsWithPagination(options: {
    offset: number;
    limit: number;
    search?: string;
    searchFields?: string[];
  }): Promise<PagerDutyEnhancedEntityMappingsResponse> {
    const mockEntities: FormattedBackstageEntity[] = [
      {
        name: 'Entity1',
        id: 'entity-id-1',
        namespace: 'default',
        type: 'component',
        system: 'system-a',
        owner: 'team-a',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'INTEGRAT1ONKEY1',
          'pagerduty.com/service-id': 'SERV1CE1D',
        },
        serviceName: 'Service1',
        serviceUrl: 'http://service1',
        team: 'Team1',
        escalationPolicy: 'Escalation Policy 1',
        status: 'InSync',
        account: 'default',
      },
      {
        name: 'Entity2',
        id: 'entity-id-2',
        namespace: 'default',
        type: 'component',
        system: 'system-b',
        owner: 'team-b',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'INTEGRAT1ONKEY2',
          'pagerduty.com/service-id': 'SERV1CE2D',
        },
        serviceName: 'Service2',
        serviceUrl: 'http://service2',
        team: 'Team1',
        escalationPolicy: 'Escalation Policy 1',
        status: 'InSync',
        account: 'default',
      },
      {
        name: 'Entity3',
        id: 'entity-id-3',
        namespace: 'default',
        type: 'component',
        system: 'system-c',
        owner: 'team-c',
        lifecycle: 'staging',
        annotations: {
          'pagerduty.com/integration-key': '',
          'pagerduty.com/service-id': '',
        },
        status: 'NotMapped',
      },
    ];

    let filteredEntities = [...mockEntities];
    if (options.search && options.search.trim() !== '') {
      const searchTerm = options.search.toLowerCase();
      filteredEntities = mockEntities.filter(
        entity =>
          entity.name.toLowerCase().includes(searchTerm) ||
          entity.owner.toLowerCase().includes(searchTerm),
      );
    }

    const startIndex = options.offset;
    const endIndex = options.offset + options.limit;
    const paginatedEntities = filteredEntities.slice(startIndex, endIndex);

    return {
      entities: paginatedEntities,
      totalCount: filteredEntities.length,
    };
  },
  async storeServiceMapping(serviceId, entityId) {
    const uuid = uuidv4();

    return new Response(
      JSON.stringify({
        service_id: serviceId,
        entity_id: entityId,
        id: uuid,
      }),
    );
  },
  async getServiceByPagerDutyEntity(pagerDutyEntity: PagerDutyEntity) {
    return {
      service: {
        name: pagerDutyEntity.name,
        id: 'SERV1CE1D',
        html_url: 'https://www.example.com',
        escalation_policy: {
          id: 'ESCALAT1ONP01ICY1D',
          name: 'ep-one',
          html_url:
            'http://www.example.com/escalation-policy/ESCALAT1ONP01ICY1D',
        },
        status: 'critical',
      },
    };
  },

  async getServiceByEntity(entity: Entity) {
    return {
      service: {
        name: entity.metadata.name,
        id: 'SERV1CE1D',
        html_url: 'https://www.example.com',
        escalation_policy: {
          id: 'ESCALAT1ONP01ICY1D',
          name: 'ep-one',
          html_url:
            'http://www.example.com/escalation-policy/ESCALAT1ONP01ICY1D',
        },
        status: 'warning',
      },
    };
  },

  async getAllServices() {
    return [
      {
        name: 'SERV1CENAME',
        id: 'random_id',
        html_url: 'https://www.example.com',
        escalation_policy: {
          id: 'ESCALAT1ONP01ICY1D',
          name: 'ep-one',
          html_url:
            'http://www.example.com/escalation-policy/ESCALAT1ONP01ICY1D',
        },
        status: 'warning',
      },
    ];
  },

  async getServiceById(serviceId: string) {
    return {
      service: {
        name: 'SERV1CENAME',
        id: serviceId,
        html_url: 'https://www.example.com',
        escalation_policy: {
          id: 'ESCALAT1ONP01ICY1D',
          name: 'ep-one',
          html_url:
            'http://www.example.com/escalation-policy/ESCALAT1ONP01ICY1D',
        },
        status: 'warning',
      },
    };
  },

  async getIncidentsByServiceId(serviceId: string) {
    const incident = (title: string) => {
      return {
        id: '123',
        title: title,
        urgency: 'low',
        status: 'triggered',
        html_url: 'http://incident',
        assignments: [
          {
            assignee: {
              id: '123',
              summary: 'Jane Doe',
              html_url: 'http://assignee',
            },
          },
        ],
        service: {
          id: serviceId,
          summary: 'service summary',
          html_url: 'http://service',
          status: 'warning',
        },
        created_at: '2015-10-06T21:30:42Z',
      } as PagerDutyIncident;
    };

    return {
      incidents: [
        incident('Some Alerting Incident'),
        incident('Another Alerting Incident'),
      ],
    };
  },

  async getChangeEventsByServiceId(serviceId: string) {
    const changeEvent = (description: string) => {
      return {
        id: serviceId,
        source: 'some-source',
        html_url: 'http://changeevent',
        links: [
          {
            href: 'http://link',
            text: 'link text',
          },
        ],
        summary: description,
        timestamp: '2018-10-06T21:30:42Z',
      } as PagerDutyChangeEvent;
    };

    return {
      change_events: [
        changeEvent('us-east-1 deployment'),
        changeEvent('us-west-2 deployment'),
      ],
    };
  },

  async getServiceStandardsByServiceId(serviceId: string) {
    const standards = () => {
      return {
        resource_id: serviceId,
        resource_type: 'technical_service',
        score: {
          total: 1,
          passing: 1,
        },
        standards: [
          {
            active: true,
            id: '123',
            name: 'Service has a description',
            description:
              'A description provides critical context about what a service represents or is used for to inform team members and responders. The description should be kept concise and understandable by those without deep knowledge of the service.',
            pass: true,
            type: 'has_technical_service_description',
          },
        ],
      };
    };

    return {
      standards: standards(),
    };
  },

  async getServiceMetricsByServiceId(serviceId: string) {
    return {
      metrics: [
        {
          service_id: serviceId,
          total_incident_count: 6,
          total_high_urgency_incidents: 3,
          total_interruptions: 2,
        },
      ],
    };
  },

  async getOnCallByPolicyId() {
    const oncall = (id: string, name: string) => {
      return {
        id: id,
        name: name,
        html_url: 'http://assignee',
        summary: 'summary',
        email: 'email@email.com',
        avatar_url: 'http://avatar',
      };
    };

    const users: PagerDutyUser[] = [
      oncall('1', 'Jane Doe'),
      oncall('2', 'John Doe'),
      oncall('3', 'James Doe'),
    ];

    return users;
  },

  async getAllTeams() {
    return [
      {
        id: 'team1',
        name: 'Team Alpha',
        html_url: 'https://www.example.com/teams/team1',
      },
      {
        id: 'team2',
        name: 'Team Beta',
        html_url: 'https://www.example.com/teams/team2',
      },
    ];
  },

  async getFilteredServices(_teamIds?: string[], _query?: string, _limit?: number) {
    return [
      {
        name: 'SERV1CENAME',
        id: 'random_id',
        html_url: 'https://www.example.com',
        escalation_policy: {
          id: 'ESCALAT1ONP01ICY1D',
          name: 'ep-one',
          html_url:
            'http://www.example.com/escalation-policy/ESCALAT1ONP01ICY1D',
        },
        status: 'warning',
      },
    ];
  },

  async triggerAlarm(request: PagerDutyTriggerAlarmRequest) {
    return new Response(request.description);
  },
};
