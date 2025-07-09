/* eslint-disable jest/no-conditional-expect */
import { HttpError, PagerDutyAccountConfig, PagerDutyChangeEvent, PagerDutyIncident, PagerDutyIncidentsResponse, PagerDutyService } from "@pagerduty/backstage-plugin-common";
import { getAllEscalationPolicies, getAllServices, getChangeEvents, getIncidents, getOncallUsers, getServiceById, getServiceByIntegrationKey, getServiceMetrics, getServiceStandards, insertEndpointConfig, setFallbackEndpointConfig } from "./pagerduty";

import { mocked } from "jest-mock";
import fetch, { Response } from "node-fetch";

jest.mock("node-fetch");

jest.mock("../auth/auth", () => ({
    getAuthToken: jest.fn().mockReturnValue(Promise.resolve('test-token')),
    loadAuthConfig: jest.fn().mockReturnValue(Promise.resolve()),
}));

const testInputs = [
    "apiToken",
    "oauth",
];

function mockedResponse(status: number, body: any): Promise<Response> {
    return Promise.resolve({
        json: () => Promise.resolve(body),
        status
    } as Response);
}

describe("PagerDuty API", () => {    
    beforeAll(() => {

        const mockAccount: PagerDutyAccountConfig = {
            id: "testaccount",
            apiBaseUrl: "https://mock.api.pagerduty.com",
            eventsBaseUrl: "https://mock.events.pagerduty.com",
        };

        insertEndpointConfig(mockAccount);
        setFallbackEndpointConfig(mockAccount);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("getAllEscalationPolicies", () => {
        it.each(testInputs)("should return ok", async () => {
            const expectedId = "P0L1CY1D";
            const expectedName = "Test Escalation Policy";
            const expectedAccount = "testaccount";

            const expectedResponse = [
                {
                    id: expectedId,
                    name: expectedName,
                    account: expectedAccount
                }
            ];

            mocked(fetch).mockReturnValue(
                mockedResponse(200, { escalation_policies: [{ id: expectedId, name: expectedName }] })
            );

            const result = await getAllEscalationPolicies();

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it.each(testInputs)("should NOT list escalation policies when caller provides invalid arguments", async () => {

            mocked(fetch).mockReturnValue(
                mockedResponse(400, {})
            );

            const expectedStatusCode = 400;
            const expectedErrorMessage = "Failed to list escalation policies. Caller provided invalid arguments.";

            try {
                await getAllEscalationPolicies();
            } catch (error) {
                expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
            }
        });

        it.each(testInputs)("should NOT list escalation policies when correct credentials are not provided", async () => {
            mocked(fetch).mockReturnValue(
                mockedResponse(401, {})
            );

            const expectedStatusCode = 401;
            const expectedErrorMessage = "Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.";

            try {
                await getAllEscalationPolicies();
            } catch (error) {
                expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
            }
        });

        it.each(testInputs)("should NOT list escalation policies when account does not have abilities to perform the action", async () => {
            mocked(fetch).mockReturnValue(
                mockedResponse(403, {})
            );

            const expectedStatusCode = 403;
            const expectedErrorMessage = "Failed to list escalation policies. Caller is not authorized to view the requested resource.";

            try {
                await getAllEscalationPolicies();
            } catch (error) {
                expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
            }
        });

        it.each(testInputs)("should NOT list escalation policies when user is not allowed to view the requested resource", async () => {
            mocked(fetch).mockReturnValue(
                mockedResponse(429, {})
            );

            const expectedStatusCode = 429;
            const expectedErrorMessage = "Failed to list escalation policies. Rate limit exceeded.";

            try {
                await getAllEscalationPolicies();
            } catch (error) {
                expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
            }
        });

        it.each(testInputs)("should work with pagination", async () => {
            const expectedId = ["P0L1CY1D1", "P0L1CY1D2", "P0L1CY1D3", "P0L1CY1D4", "P0L1CY1D5", "P0L1CY1D6", "P0L1CY1D7", "P0L1CY1D8", "P0L1CY1D9", "P0L1CY1D10"];
            const expectedName = ["Test Escalation Policy 1", "Test Escalation Policy 2", "Test Escalation Policy 3", "Test Escalation Policy 4", "Test Escalation Policy 5", "Test Escalation Policy 6", "Test Escalation Policy 7", "Test Escalation Policy 8", "Test Escalation Policy 9", "Test Escalation Policy 10"];
            const expectedAccount = "testaccount";

            const expectedResponse = [
                {
                    id: expectedId[0],
                    name: expectedName[0],
                    account: expectedAccount
                },
                {
                    id: expectedId[1],
                    name: expectedName[1],
                    account: expectedAccount
                },
                {
                    id: expectedId[2],
                    name: expectedName[2],
                    account: expectedAccount
                },
                {
                    id: expectedId[3],
                    name: expectedName[3],
                    account: expectedAccount
                },
                {
                    id: expectedId[4],
                    name: expectedName[4],
                    account: expectedAccount
                },
                {
                    id: expectedId[5],
                    name: expectedName[5],
                    account: expectedAccount
                },
                {
                    id: expectedId[6],
                    name: expectedName[6],
                    account: expectedAccount
                },
                {
                    id: expectedId[7],
                    name: expectedName[7],
                    account: expectedAccount
                },
                {
                    id: expectedId[8],
                    name: expectedName[8],
                    account: expectedAccount
                },
                {
                    id: expectedId[9],
                    name: expectedName[9],
                    account: expectedAccount
                }
            ];

            mocked(fetch).mockReturnValueOnce(
                mockedResponse(200, {
                    escalation_policies: [
                        {
                            id: expectedId[0],
                            name: expectedName[0],
                        },
                        {
                            id: expectedId[1],
                            name: expectedName[1],
                        }
                    ],
                    more: true
                })                
            ).mockReturnValueOnce(
                mockedResponse(200, {
                        escalation_policies: [
                            {
                                id: expectedId[2],
                                name: expectedName[2],
                            },
                            {
                                id: expectedId[3],
                                name: expectedName[3],
                            }
                        ],
                        more: true
                    })
            ).mockReturnValueOnce(
                mockedResponse(200, {
                        escalation_policies: [
                            {
                                id: expectedId[4],
                                name: expectedName[4],
                            },
                            {
                                id: expectedId[5],
                                name: expectedName[5],
                            }
                        ],
                        more: true
                    })
            ).mockReturnValueOnce(
                mockedResponse(200, {
                        escalation_policies: [
                            {
                                id: expectedId[6],
                                name: expectedName[6],
                            },
                            {
                                id: expectedId[7],
                                name: expectedName[7],
                            }
                        ],
                        more: true
                    })
            ).mockReturnValueOnce(
                mockedResponse(200, {
                        escalation_policies: [
                            {
                                id: expectedId[8],
                                name: expectedName[8],
                            },
                            {
                                id: expectedId[9],
                                name: expectedName[9],
                            }
                        ],
                        more: false
                    })
            );

            const result = await getAllEscalationPolicies();

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(10);
            expect(fetch).toHaveBeenCalledTimes(5);
        });
    });

    describe("getOncallUsers", () => {
        it.each(testInputs)("should return list of users ordered by name ASC from escalation policy level 1", async () => {
            const escalationPolicyId = "12345";
            const expectedResponse = [
                {
                    id: "userId2",
                    name: "Jane Doe",
                    email: "jane.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "Jane Doe",
                },
                {
                    id: "userId1",
                    name: "John Doe",
                    email: "john.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "John Doe",
                }
            ];

            const mockAPIResponse = {
                "oncalls": [
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": expectedResponse[1].id,
                            "summary": expectedResponse[1].summary,
                            "name": expectedResponse[1].name,
                            "email": expectedResponse[1].email,
                            "avatar_url": expectedResponse[1].avatar_url,
                            "html_url": expectedResponse[1].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": "userId3",
                            "summary": "James Doe",
                            "name": "James Doe",
                            "email": "james.does@email.com",
                            "avatar_url": "https://example.pagerduty.com/avatars/123",
                            "html_url": "https://example.pagerduty.com/users/123",
                        },
                        "escalation_level": 2
                    }
                ]
            };

            mocked(fetch).mockReturnValue(
                mockedResponse(200, mockAPIResponse)
            );

            const result = await getOncallUsers(escalationPolicyId);

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(2);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it.each(testInputs)("should return single user from escalation policy level 1", async () => {
            const escalationPolicyId = "12345";
            const expectedResponse = [
                {
                    id: "userId1",
                    name: "John Doe",
                    email: "john.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "John Doe",
                }
            ];

            const mockAPIResponse = {
                "oncalls": [
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": "userId2",
                            "summary": "James Doe",
                            "name": "James Doe",
                            "email": "james.does@email.com",
                            "avatar_url": "https://example.pagerduty.com/avatars/123",
                            "html_url": "https://example.pagerduty.com/users/123",
                        },
                        "escalation_level": 2
                    }
                ]
            };

            mocked(fetch).mockReturnValue(
                mockedResponse(200, mockAPIResponse)
            );

            const result = await getOncallUsers(escalationPolicyId);

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it.each(testInputs)("should return relevant users from escalation policy level 1 even if another level is returned first", async () => {
            const escalationPolicyId = "12345";
            const expectedResponse = [
                {
                    id: "userId1",
                    name: "John Doe",
                    email: "john.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "John Doe",
                }
            ];

            const mockAPIResponse = {
                "oncalls": [
                    {
                        "user": {
                            "id": "userId3",
                            "summary": "Jane Doe",
                            "name": "Jane Doe",
                            "email": "jane.does@email.com",
                            "avatar_url": "https://example.pagerduty.com/avatars/123",
                            "html_url": "https://example.pagerduty.com/users/123",
                        },
                        "escalation_level": 3
                    },
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": "userId2",
                            "summary": "James Doe",
                            "name": "James Doe",
                            "email": "james.does@email.com",
                            "avatar_url": "https://example.pagerduty.com/avatars/123",
                            "html_url": "https://example.pagerduty.com/users/123",
                        },
                        "escalation_level": 2
                    }
                ]
            };

            mocked(fetch).mockReturnValue(
                mockedResponse(200, mockAPIResponse)
            );

            const result = await getOncallUsers(escalationPolicyId);

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it.each(testInputs)("should return list of users ordered by name ASC from other escalation levels when level 1 is empty", async () => {
            const escalationPolicyId = "12345";
            const expectedResponse = [
                {
                    id: "userId2",
                    name: "Jane Doe",
                    email: "jane.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "Jane Doe",
                },
                {
                    id: "userId1",
                    name: "John Doe",
                    email: "john.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "John Doe",
                }
            ];

            const mockAPIResponse = {
                "oncalls": [
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 2
                    },
                    {
                        "user": {
                            "id": expectedResponse[1].id,
                            "summary": expectedResponse[1].summary,
                            "name": expectedResponse[1].name,
                            "email": expectedResponse[1].email,
                            "avatar_url": expectedResponse[1].avatar_url,
                            "html_url": expectedResponse[1].html_url,
                        },
                        "escalation_level": 2
                    },
                    {
                        "user": {
                            "id": "userId3",
                            "summary": "James Doe",
                            "name": "James Doe",
                            "email": "james.does@email.com",
                            "avatar_url": "https://example.pagerduty.com/avatars/123",
                            "html_url": "https://example.pagerduty.com/users/123",
                        },
                        "escalation_level": 3
                    }
                ]
            };

            mocked(fetch).mockReturnValue(
                mockedResponse(200, mockAPIResponse)
            );

            const result = await getOncallUsers(escalationPolicyId);

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(2);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it.each(testInputs)("should return list of users ordered by name ASC without duplicates", async () => {
            const escalationPolicyId = "12345";
            const expectedResponse = [
                {
                    id: "userId2",
                    name: "Jane Doe",
                    email: "jane.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "Jane Doe",
                },
                {
                    id: "userId1",
                    name: "John Doe",
                    email: "john.doe@email.com",
                    avatar_url: "https://example.pagerduty.com/avatars/123",
                    html_url: "https://example.pagerduty.com/users/123",
                    summary: "John Doe",
                }
            ];

            const mockAPIResponse = {
                "oncalls": [
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": expectedResponse[1].id,
                            "summary": expectedResponse[1].summary,
                            "name": expectedResponse[1].name,
                            "email": expectedResponse[1].email,
                            "avatar_url": expectedResponse[1].avatar_url,
                            "html_url": expectedResponse[1].html_url,
                        },
                        "escalation_level": 1
                    },
                    {
                        "user": {
                            "id": expectedResponse[0].id,
                            "summary": expectedResponse[0].summary,
                            "name": expectedResponse[0].name,
                            "email": expectedResponse[0].email,
                            "avatar_url": expectedResponse[0].avatar_url,
                            "html_url": expectedResponse[0].html_url,
                        },
                        "escalation_level": 1
                    }
                ]
            };

            mocked(fetch).mockReturnValue(
                mockedResponse(200, mockAPIResponse)
            );

            const result = await getOncallUsers(escalationPolicyId);

            expect(result).toEqual(expectedResponse);
            expect(result.length).toEqual(2);
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe("getServices", () => {
        describe("getServicesByIntegrationKey", () => {
            it.each(testInputs)("should return service when 'integration_key' is provided", async () => {
                const integrationKey = "INT3GR4T10N_K3Y";
                const expectedResponse: PagerDutyService = {
                    id: "S3RV1CE1D",
                    name: "Test Service",
                    description: "Test Service Description",
                    html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
                    escalation_policy: {
                        id: "P0L1CY1D",
                        name: "Test Escalation Policy",
                        html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                        type: "escalation_policy_reference",
                    },
                    status: "active",
                };

                const mockAPIResponse = {
                    "services": [
                        {
                            "id": expectedResponse.id,
                            "name": expectedResponse.name,
                            "description": expectedResponse.description,
                            "status": expectedResponse.status,
                            "escalation_policy": {
                                "id": expectedResponse.escalation_policy.id,
                                "name": expectedResponse.escalation_policy.name,
                                "type": expectedResponse.escalation_policy.type,
                                "html_url": expectedResponse.escalation_policy.html_url
                            },
                            "html_url": expectedResponse.html_url
                        }
                    ],
                    "limit": 25,
                    "offset": 0,
                    "total": null,
                    "more": false
                };

                mocked(fetch).mockReturnValue(
                    mockedResponse(200, mockAPIResponse)
                );

                const result = await getServiceByIntegrationKey(integrationKey);

                expect(result).toEqual(expectedResponse);
                expect(fetch).toHaveBeenCalledTimes(1);
            });

            it.each(testInputs)("should NOT get service when caller provides invalid arguments", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );

                const integrationKey = "INT3GR4T10N_K3Y";
                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get service. Caller provided invalid arguments.";

                try {
                    await getServiceByIntegrationKey(integrationKey);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );

                const integrationKey = "INT3GR4T10N_K3Y";
                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get service. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getServiceByIntegrationKey(integrationKey);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service if credentials do not provided the required permissions", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(403, {})
                );

                const integrationKey = "INT3GR4T10N_K3Y";
                const expectedStatusCode = 403;
                const expectedErrorMessage = "Failed to get service. Caller is not authorized to view the requested resource.";

                try {
                    await getServiceByIntegrationKey(integrationKey);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service if service does not exist", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(404, {})
                );

                const integrationKey = "INT3GR4T10N_K3Y";
                const expectedStatusCode = 404;
                const expectedErrorMessage = "Failed to get service. The requested resource was not found.";

                try {
                    await getServiceByIntegrationKey(integrationKey);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });

        describe("getAllServices", () => {
            it.each(testInputs)("show return list of PagerDuty services", async () => {
                const expectedResponse: PagerDutyService[] = [{
                    id: "S3RV1CE1D",
                    name: "Test Service",
                    description: "Test Service Description",
                    account: "testaccount",
                    html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
                    escalation_policy: {
                        id: "P0L1CY1D",
                        name: "Test Escalation Policy",
                        html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                        type: "escalation_policy_reference",
                    },
                    status: "active",
                },
                {
                    id: "S3RV1CE2D",
                    name: "Test Service",
                    description: "Test Service Description",
                    account: "testaccount",
                    html_url: "https://testaccount.pagerduty.com/services/S3RV1CE2D",
                    escalation_policy: {
                        id: "P0L1CY1D",
                        name: "Test Escalation Policy",
                        html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                        type: "escalation_policy_reference",
                    },
                    status: "active",
                }];

                const mockAPIResponse = {
                    "services": [
                    {
                        "id": expectedResponse[0].id,
                        "name": expectedResponse[0].name,
                            "description": expectedResponse[0].description,
                            "status": expectedResponse[0].status,
                        "escalation_policy": {
                            "id": expectedResponse[0].escalation_policy.id,
                            "name": expectedResponse[0].escalation_policy.name,
                            "type": expectedResponse[0].escalation_policy.type,
                            "html_url": expectedResponse[0].escalation_policy.html_url
                        },
                            "html_url": expectedResponse[0].html_url
                    },
                    {
                        "id": expectedResponse[1].id,
                        "name": expectedResponse[1].name,
                        "description": expectedResponse[1].description,
                        "status": expectedResponse[1].status,
                        "escalation_policy": {
                            "id": expectedResponse[1].escalation_policy.id,
                            "name": expectedResponse[1].escalation_policy.name,
                            "type": expectedResponse[1].escalation_policy.type,
                            "html_url": expectedResponse[1].escalation_policy.html_url
                        },
                        "html_url": expectedResponse[1].html_url
                    }]
                };

                mocked(fetch).mockReturnValue(
                    mockedResponse(200, mockAPIResponse)
                );

                const result = await getAllServices();

                expect(result).toEqual(expectedResponse);
                expect(fetch).toHaveBeenCalledTimes(1);
            });


            it.each(testInputs)("should NOT get services when caller provides invalid arguments", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );

                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get services. Caller provided invalid arguments.";

                try {
                    await getAllServices();
                } catch (error) {
                    expect(fetch).toHaveBeenCalledTimes(1);
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get services when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );

                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get services. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getAllServices();
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get services when credentials are provided but don't have the necessary permissions", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(403, {})
                );

                const expectedStatusCode = 403;
                const expectedErrorMessage = "Failed to get services. Caller is not authorized to view the requested resource.";

                try {
                    await getAllServices();
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });
    
        describe("getServicesById", () => {
            it.each(testInputs)("should return service when 'service_id' is provided", async () => {
                const serviceId = "SERV1C31D";
                const expectedResponse: PagerDutyService = {
                    id: "S3RV1CE1D",
                    name: "Test Service",
                    description: "Test Service Description",
                    html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
                    escalation_policy: {
                        id: "P0L1CY1D",
                        name: "Test Escalation Policy",
                        html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                        type: "escalation_policy_reference",
                    },
                    status: "active",
                };

                const mockAPIResponse = {
                    "service":
                    {
                        "id": expectedResponse.id,
                        "name": expectedResponse.name,
                        "description": expectedResponse.description,
                        "status": expectedResponse.status,
                        "escalation_policy": {
                            "id": expectedResponse.escalation_policy.id,
                            "name": expectedResponse.escalation_policy.name,
                            "type": expectedResponse.escalation_policy.type,
                            "html_url": expectedResponse.escalation_policy.html_url
                        },
                        "html_url": expectedResponse.html_url
                    }
                };

                mocked(fetch).mockReturnValue(
                    mockedResponse(200, mockAPIResponse)
                );

                const result = await getServiceById(serviceId);

                expect(result).toEqual(expectedResponse);
                expect(fetch).toHaveBeenCalledTimes(1);
            });

            it.each(testInputs)("should NOT get service when caller provides invalid arguments", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get service. Caller provided invalid arguments.";

                try {
                    await getServiceById(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get service. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getServiceById(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });

        describe("getChangeEvents", () => {
            it.each(testInputs)("should return change events list", async () => {
                const serviceId = "SERV1C31D";
                const expectedResponse: PagerDutyChangeEvent[] = [
                    {
                        id: "CH4NG3_3V3NT_1D",
                        source: "GitHub",
                        summary: "Test Change Event 1",
                        timestamp: "2020-01-01T00:00:00Z",
                        links: [
                            {
                                href: "https://example.pagerduty.com/change_events/CH4NG3_3V3NT_1D",
                                text: "View in PagerDuty",
                            },
                        ],
                        integration: [
                            {
                                id: "INT3GR4T10N_1D",
                                summary: "Test Integration 1",
                                type: "github",
                                html_url: "https://example.pagerduty.com/integrations/INT3GR4T10N_1D",
                            }
                        ]
                    },
                    {
                        id: "CH4NG3_3V3NT_2D",
                        source: "GitHub",
                        summary: "Test Change Event 2",
                        timestamp: "2020-01-01T10:00:00Z",
                        links: [
                            {
                                href: "https://example.pagerduty.com/change_events/CH4NG3_3V3NT_2D",
                                text: "View in PagerDuty",
                            },
                        ],
                        integration: [
                            {
                                id: "INT3GR4T10N_2D",
                                summary: "Test Integration 2",
                                type: "github",
                                html_url: "https://example.pagerduty.com/integrations/INT3GR4T10N_2D",
                            }
                        ]
                    }
                ];

                const mockAPIResponse = {
                    "change_events": [
                        {
                            "id": expectedResponse[0].id,
                            "source": expectedResponse[0].source,
                            "summary": expectedResponse[0].summary,
                            "timestamp": expectedResponse[0].timestamp,
                            "links": [
                                {
                                    "href": expectedResponse[0].links[0].href,
                                    "text": expectedResponse[0].links[0].text,
                                }
                            ],
                            "integration": [
                                {
                                    "id": expectedResponse[0].integration[0].id,
                                    "summary": expectedResponse[0].integration[0].summary,
                                    "type": expectedResponse[0].integration[0].type,
                                    "html_url": expectedResponse[0].integration[0].html_url,
                                }
                            ]
                        },
                        {
                            "id": expectedResponse[1].id,
                            "source": expectedResponse[1].source,
                            "summary": expectedResponse[1].summary,
                            "timestamp": expectedResponse[1].timestamp,
                            "links": [
                                {
                                    "href": expectedResponse[1].links[0].href,
                                    "text": expectedResponse[1].links[0].text,
                                }
                            ],
                            "integration": [
                                {
                                    "id": expectedResponse[1].integration[0].id,
                                    "summary": expectedResponse[1].integration[0].summary,
                                    "type": expectedResponse[1].integration[0].type,
                                    "html_url": expectedResponse[1].integration[0].html_url,
                                }
                            ]
                        }
                    ]
                };

                mocked(fetch).mockReturnValue(
                    mockedResponse(200, mockAPIResponse)
                );

                const result = await getChangeEvents(serviceId);

                expect(result).toEqual(expectedResponse);
                expect(fetch).toHaveBeenCalledTimes(1);
            });

            it.each(testInputs)("should NOT get change events when caller provides invalid arguments", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get change events for service. Caller provided invalid arguments.";

                try {
                    await getChangeEvents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get change events for service. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getChangeEvents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get change events if credentials do not provide necessary permissions", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(403, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 403;
                const expectedErrorMessage = "Failed to get change events for service. Caller is not authorized to view the requested resource.";

                try {
                    await getChangeEvents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });

        describe("getIncidents", () => {
            it.each(testInputs)("should return incidents list", async () => {
                const serviceId = "SERV1C31D";
                const expectedResponse: PagerDutyIncident[] = [
                    {
                        id: "1NC1D3NT_1D",
                        status: "triggered",
                        title: "Test Incident 1",
                        urgency: "high",
                        service: {
                            id: "S3RV1CE1D",
                            name: "Test Service",
                            html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
                            escalation_policy: {
                                id: "P0L1CY1D",
                                name: "Test Escalation Policy",
                                html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                                type: "escalation_policy_reference",
                            },
                        },
                        created_at: "2020-01-01T00:00:00Z",
                        html_url: "https://example.pagerduty.com/incidents/1NC1D3NT_1D",
                        assignments: [
                            {
                                assignee: {
                                    id: "userId1",
                                    summary: "John Doe",
                                    name: "John Doe",
                                    email: "john.doe@email.com",
                                    avatar_url: "https://example.pagerduty.com/avatars/123",
                                    html_url: "https://example.pagerduty.com/users/123",
                                }
                            }
                        ]
                    },
                    {
                        id: "1NC1D3NT_2D",
                        status: "triggered",
                        urgency: "high",
                        title: "Test Incident 2",
                        service: {
                            id: "S3RV1CE1D",
                            name: "Test Service",
                            html_url: "https://testaccount.pagerduty.com/services/S3RV1CE1D",
                            escalation_policy: {
                                id: "P0L1CY1D",
                                name: "Test Escalation Policy",
                                html_url: "https://testaccount.pagerduty.com/escalation_policies/P0L1CY1D",
                                type: "escalation_policy_reference",
                            },
                        },
                        created_at: "2020-01-01T10:00:00Z",
                        html_url: "https://example.pagerduty.com/incidents/1NC1D3NT_2D",
                        assignments: [
                            {
                                assignee: {
                                    id: "userId1",
                                    summary: "John Doe",
                                    name: "John Doe",
                                    email: "john.doe@email.com",
                                    avatar_url: "https://example.pagerduty.com/avatars/123",
                                    html_url: "https://example.pagerduty.com/users/123",
                                }
                            }
                        ]
                    }
                ];

                const mockAPIResponse: PagerDutyIncidentsResponse = {
                    "incidents": [
                        {
                            id: expectedResponse[0].id,
                            status: expectedResponse[0].status,
                            urgency: expectedResponse[0].urgency,                        
                            title: expectedResponse[0].title,
                            created_at: expectedResponse[0].created_at,
                            html_url: expectedResponse[0].html_url,
                            service: {
                                id: expectedResponse[0].service.id,
                                name: expectedResponse[0].service.name,
                                html_url: expectedResponse[0].service.html_url,
                                escalation_policy: {
                                    id: expectedResponse[0].service.escalation_policy.id,
                                    name: expectedResponse[0].service.escalation_policy.name,
                                    html_url: expectedResponse[0].service.escalation_policy.html_url,
                                    type: expectedResponse[0].service.escalation_policy.type,
                                },
                            },
                            assignments: [
                                {
                                    assignee: {
                                        id: expectedResponse[0].assignments[0].assignee.id,
                                        summary: expectedResponse[0].assignments[0].assignee.summary,
                                        name: expectedResponse[0].assignments[0].assignee.name,
                                        email: expectedResponse[0].assignments[0].assignee.email,
                                        avatar_url: expectedResponse[0].assignments[0].assignee.avatar_url,
                                        html_url: expectedResponse[0].assignments[0].assignee.html_url,
                                    }
                                }
                            ]
                        },
                        {
                            id: expectedResponse[1].id,
                            status: expectedResponse[1].status,
                            urgency: expectedResponse[1].urgency,
                            title: expectedResponse[1].title,
                            created_at: expectedResponse[1].created_at,
                            html_url: expectedResponse[1].html_url,
                            service: {
                                id: expectedResponse[1].service.id,
                                name: expectedResponse[1].service.name,
                                html_url: expectedResponse[1].service.html_url,
                                escalation_policy: {
                                    id: expectedResponse[1].service.escalation_policy.id,
                                    name: expectedResponse[1].service.escalation_policy.name,
                                    html_url: expectedResponse[1].service.escalation_policy.html_url,
                                    type: expectedResponse[1].service.escalation_policy.type,
                                },
                            },
                            assignments: [
                                {
                                    assignee: {
                                        id: expectedResponse[1].assignments[0].assignee.id,
                                        summary: expectedResponse[1].assignments[0].assignee.summary,
                                        name: expectedResponse[1].assignments[0].assignee.name,
                                        email: expectedResponse[1].assignments[0].assignee.email,
                                        avatar_url: expectedResponse[1].assignments[0].assignee.avatar_url,
                                        html_url: expectedResponse[1].assignments[0].assignee.html_url,
                                    }
                                }
                            ]
                        }
                    ]
                };

                mocked(fetch).mockReturnValue(
                    mockedResponse(200, mockAPIResponse)
                );
                
                const result = await getIncidents(serviceId);

                expect(result).toEqual(expectedResponse);
                expect(fetch).toHaveBeenCalledTimes(1);
            });

            it.each(testInputs)("should NOT get incident when caller provides invalid arguments", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get incidents for service. Caller provided invalid arguments.";

                try {
                    await getIncidents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get incidents when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get incidents for service. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getIncidents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get incidents if credentials do not provide the required abilities", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(402, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 402;
                const expectedErrorMessage = "Failed to get incidents for service. Account does not have the abilities to perform the action. Please review the response for the required abilities.";

                try {
                    await getIncidents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get incidents if credentials defined do not have the necessary permissions", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(403, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 403;
                const expectedErrorMessage = "Failed to get incidents for service. Caller is not authorized to view the requested resource.";

                try {
                    await getIncidents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get incidents if PagerDuty REST API limits have been reached", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(429, {})
                );
                
                const serviceId = "SERV1C31D";
                const expectedStatusCode = 429;
                const expectedErrorMessage = "Failed to get incidents for service. Too many requests have been made, the rate limit has been reached.";

                try {
                    await getIncidents(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });

        describe("getStandards", () => {
            it.each(testInputs)("should NOT get service standards when correct credentials are not provided", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(401, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 401;
                const expectedErrorMessage = "Failed to get service standards for service. Caller did not supply credentials or did not provide the correct credentials.";

                try {
                    await getServiceStandards(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service standards if credentials defined do not have the necessary permissions", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(403, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 403;
                const expectedErrorMessage = "Failed to get service standards for service. Caller is not authorized to view the requested resource.";

                try {
                    await getServiceStandards(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service standards if PagerDuty REST API limits have been reached", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(429, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 429;
                const expectedErrorMessage = "Failed to get service standards for service. Too many requests have been made, the rate limit has been reached.";

                try {
                    await getServiceStandards(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });

        describe("getMetrics", () => {
            it.each(testInputs)("should NOT get service metrics if payload is malformed", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(400, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 400;
                const expectedErrorMessage = "Failed to get service metrics for service. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.";

                try {
                    await getServiceMetrics(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });

            it.each(testInputs)("should NOT get service metrics if PagerDuty REST API limits have been reached", async () => {
                mocked(fetch).mockReturnValue(
                    mockedResponse(429, {})
                );

                const serviceId = "SERV1C31D";
                const expectedStatusCode = 429;
                const expectedErrorMessage = "Failed to get service metrics for service. Too many requests have been made, the rate limit has been reached.";

                try {
                    await getServiceMetrics(serviceId);
                } catch (error) {
                    expect(((error as HttpError).status)).toEqual(expectedStatusCode);
                    expect(((error as HttpError).message)).toEqual(expectedErrorMessage);
                }
            });
        });
    });
});

