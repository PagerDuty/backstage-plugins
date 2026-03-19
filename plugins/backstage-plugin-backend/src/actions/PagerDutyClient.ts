import {
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import {
  PagerDutyOnCall,
  PagerDutyOnCallsResponse,
  PagerDutyService,
  PagerDutyServiceResponse,
} from '@pagerduty/backstage-plugin-common';

export class PagerDutyClient {
  private readonly discovery: DiscoveryService;
  private readonly auth: AuthService;

  constructor(options: {
    discovery: DiscoveryService;
    auth: AuthService;
  }) {
    this.discovery = options.discovery;
    this.auth = options.auth;
  }

  private async fetch(path: string): Promise<Response> {
    const baseUrl = await this.discovery.getBaseUrl('pagerduty');
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'pagerduty',
    });

    return fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getServiceByIntegrationKey(
    integrationKey: string,
  ): Promise<PagerDutyService> {
    const response = await this.fetch(
      `/services?integration_key=${encodeURIComponent(integrationKey)}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get service for integration key ${integrationKey}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as PagerDutyServiceResponse;
    return data.service;
  }

  async getOncalls(escalationPolicyId: string): Promise<PagerDutyOnCall[]> {
    const response = await this.fetch(
      `/oncalls?escalation_policy_ids=${encodeURIComponent(escalationPolicyId)}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get oncalls for escalation policy ${escalationPolicyId}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as PagerDutyOnCallsResponse;
    return data.oncalls;
  }
}
