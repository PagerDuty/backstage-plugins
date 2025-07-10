/** @public */
export type PagerDutyIncident = {
    id: string;
    title: string;
    status: string;
    html_url: string;
    assignments: [
        {
        assignee: PagerDutyUser;
        },
    ];
    service: PagerDutyService;
    created_at: string;
    urgency?: string;
}

/** @public */
export type PagerDutyUser = {
    id: string;
    summary: string;
    email: string;
    html_url: string;
    name: string;
    avatar_url: string;
};

/** @public */
export type PagerDutyChangeEvent = {
    id: string;
    integration: PagerDutyIntegration[];
    source: string;
    html_url?: string;
    links: [
        {
            href: string;
            text: string;
        },
    ];
    summary: string;
    timestamp: string;
}

/** @public */
export type PagerDutyService = {
    id: string;
    name: string;
    description?: string;
    escalation_policy: PagerDutyEscalationPolicy; 
    alert_creation?: string;
    incident_urgency_rule?: PagerDutyIncidentUrgencyRule;
    integrations?: PagerDutyIntegration[];
    teams?: PagerDutyTeam[];
    status?: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url: string;
    account?: string;
}

/** @public */
export type PagerDutyEscalationPolicy = {
    id: string;
    name: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
    account?: string;
}

/** @public */
export type PagerDutyIncidentUrgencyRule = {
    type: string;
    urgency: string;
}

/** @public */
export type PagerDutyIntegration = {
    id: string;
    type: string;
    summary?: string;
    self?: string;
    html_url?: string;
    name?: string;
    service?: PagerDutyService;
    created_at?: string;
    vendor?: PagerDutyVendor;
    integration_key?: string;
}

/** @public */
export type PagerDutyTeam = {
    id: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
    name: string;
}

/** @public  */
export type PagerDutyOnCall = {
    user: PagerDutyUser;
    escalation_level: number;
}

/** @public */
export type PagerDutyOnCallUsersResponse = {
    users: PagerDutyUser[];
}

/** @public */
export type PagerDutyVendor = {
    id: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
}

/** @public */
export type PagerDutyServiceStandards = {
    resource_id: string;
    resource_type: string;
    score: {
        passing: number;
        total: number;
    };
    standards: PagerDutyServiceStandard[];
}

/** @public */
export type PagerDutyServiceStandard = {
    active: boolean;
    description: string;
    id: string;
    name: string;
    pass: boolean;
    type: string;
}

/** @public */
export type PagerDutyServiceStandardsResponse = {
    standards: PagerDutyServiceStandards;
}

/** @public */
export type PagerDutyServiceMetrics = {
    mean_assignment_count?: number;
    mean_engaged_seconds?: number;
    mean_engaged_user_count?: number;
    mean_seconds_to_engage?: number;
    mean_seconds_to_first_ack?: number;
    mean_seconds_to_mobilize?: number;
    mean_seconds_to_resolve?: number;
    mean_user_defined_engaged_seconds?: number;
    service_id: string;
    service_name?: string;
    team_id?: string;
    team_name?: string;
    total_business_hour_interruptions?: number;
    total_down_time_minutes?: number;
    total_engaged_seconds?: number;
    total_escalation_count?: number;
    total_high_urgency_incidents?: number;
    total_incident_count?: number;
    total_incidents_acknowledged?: number;
    total_incidents_auto_resolved?: number;
    total_incidents_manual_escalated?: number;
    total_incidents_reassigned?: number;
    total_incidents_timeout_escalated?: number;
    total_interruptions?: number;
    total_low_urgency_incidents?: number;
    total_major_incidents?: number;
    total_notifications?: number;
    total_off_hour_interruptions?: number;
    total_sleep_hour_interruptions?: number;
    total_snoozed_seconds?: number;
    total_user_defined_engaged_seconds?: number;
    up_time_pct?: number;
}

/** @public */
export type PagerDutyServiceMetricsResponse = {
    metrics: PagerDutyServiceMetrics[]
}

/** @public */
export type PagerDutyServicesResponse = {
    services: PagerDutyService[];
};

/** @public */
export type PagerDutyServicesAPIResponse = PagerDutyServicesResponse & {
    offset: number;
    limit: number;
    total: number | null;
    more: boolean;
};

/** @public */
export type PagerDutyServiceResponse = {
    service: PagerDutyService;
};

/** @public */
export type PagerDutyIncidentsResponse = {
    incidents: PagerDutyIncident[];
};

/** @public */
export type PagerDutyChangeEventsResponse = {
    change_events: PagerDutyChangeEvent[];
};

/** @public */
export type PagerDutyOnCallsResponse = {
    oncalls: PagerDutyOnCall[];
};

/** @public */
export type PagerDutyIntegrationResponse = {
    integration: PagerDutyIntegration;
}

/** @public */
export type PagerDutyEscalationPoliciesResponse = {
    escalation_policies: PagerDutyEscalationPolicy[];
    limit?: number;
    offset?: number;
    more?: boolean;
    total?: number;
};

/** @public */
export type PagerDutyAbilitiesResponse = {
    abilities: string[];
};

/** @public */
export class HttpError extends Error {
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }

    status: number;
}

/** @public */
export type PagerDutyOAuthConfig = {
    clientId: string;
    clientSecret: string;
    region?: string;
    subDomain: string;
}

/** @public */
export type PagerDutyAccountConfig = {
    id: string;
    isDefault?: boolean;
    eventsBaseUrl?: string;
    apiBaseUrl?: string;
    apiToken?: string;
    oauth?: PagerDutyOAuthConfig;
}

/** @public */
export type PagerDutyEntityMapping = {
    entityRef: string;
    entityName?: string;
    serviceId: string;
    serviceName?: string;
    integrationKey?: string;
    serviceUrl?: string;
    status?: "NotMapped" | "InSync" | "OutOfSync";
    processedDate?: Date;
    team?: string;
    escalationPolicy?: string;
    account?: string;
};

/** @public */
export type PagerDutyEntityMappingsResponse = {
    mappings: PagerDutyEntityMapping[];
};

/** @public */
export type PagerDutyEntityMappingResponse = {
    mapping: PagerDutyEntityMapping;
};

/** @public */
export type PagerDutyServiceDependencyReference = {
    id: string;
    type: string;
}

/** @public */
export type PagerDutyServiceDependency = {
    id?: string,
    type?: string,
    supporting_service: PagerDutyServiceDependencyReference,
    dependent_service: PagerDutyServiceDependencyReference,
}

/** @public */
export type PagerDutyServiceDependencyResponse = {
    relationships: PagerDutyServiceDependency[];
}

/** @public */
export type PagerDutySetting = {
    id: string;
    value: "backstage" | "pagerduty" | "both" | "disabled";
}

/** @public */
export type PagerDutySettings = {
    settings: PagerDutySetting[];
}