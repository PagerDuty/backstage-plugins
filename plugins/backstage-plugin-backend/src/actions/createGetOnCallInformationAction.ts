import {
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { PagerDutyClient } from './PagerDutyClient';

export const createGetOnCallInformationAction = ({
  actionsRegistry,
  discovery,
  auth,
}: {
  actionsRegistry: ActionsRegistryService;
  discovery: DiscoveryService;
  auth: AuthService;
}) => {
  const client = new PagerDutyClient({ discovery, auth });

  actionsRegistry.register({
    name: 'get-on-call-information',
    title: 'Get On Call Information',
    description:
      'This allows you to get the on call information from PagerDuty for a given integration key. The integration key can be read from the pagerduty.com/integration-key within metadata.annotations on an entity in the software catalog. It is typically found entities of kind "Component". To look up on-call information for a group or user one must find the components owned by them, while for domains or systems the "partOf" relation must be traversed to find associated components. The integration key is a string of the form "1235213623234623462353452452345". A good summary of the on-call information is onCall.user.name, onCall.schedule.summary, and onCall.escalationPolicy.summary.',
    schema: {
      input: z =>
        z.object({
          integrationKeys: z
            .array(z.string())
            .describe('A list of integration keys to query'),
        }),
      output: z =>
        z.object({
          onCallInformation: z
            .record(
              z.string(),
              z.object({
                service: z
                  .object({
                    id: z.string().describe('The PagerDuty service ID'),
                    name: z.string().describe('The PagerDuty service name'),
                    html_url: z
                      .string()
                      .describe('Link to the service in PagerDuty'),
                  })
                  .describe('The PagerDuty service associated with the integration key'),
                oncalls: z
                  .array(
                    z.object({
                      user: z
                        .object({
                          name: z.string().describe('The on-call user name'),
                          email: z.string().describe('The on-call user email'),
                          html_url: z
                            .string()
                            .describe('Link to the user in PagerDuty'),
                        })
                        .describe('The user who is on call'),
                      escalation_level: z
                        .number()
                        .describe('The escalation level this user is on call for'),
                      schedule: z
                        .object({
                          summary: z
                            .string()
                            .describe('The name of the on-call schedule'),
                        })
                        .optional()
                        .describe('The schedule that put this user on call'),
                      escalation_policy: z
                        .object({
                          summary: z
                            .string()
                            .describe('The name of the escalation policy'),
                        })
                        .optional()
                        .describe('The escalation policy for this on-call entry'),
                    }),
                  )
                  .describe('The list of on-call entries for this service'),
              }),
            )
            .describe('A map of integration key to on-call information'),
        }),
    },
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    action: async ({ input }) => {
      const onCallInformation = Object.fromEntries(
        await Promise.all(
          input.integrationKeys.map(async integrationKey => {
            const service =
              await client.getServiceByIntegrationKey(integrationKey);
            const oncalls = await client.getOncalls(
              service.escalation_policy.id,
            );

            return [
              integrationKey,
              {
                service: {
                  id: service.id,
                  name: service.name,
                  html_url: service.html_url,
                },
                oncalls: oncalls.map(oncall => ({
                  user: {
                    name: oncall.user.name,
                    email: oncall.user.email,
                    html_url: oncall.user.html_url,
                  },
                  escalation_level: oncall.escalation_level,
                  schedule: oncall.schedule
                    ? { summary: oncall.schedule.summary }
                    : undefined,
                  escalation_policy: oncall.escalation_policy
                    ? { summary: oncall.escalation_policy.summary }
                    : undefined,
                })),
              },
            ];
          }),
        ),
      );

      return {
        output: {
          onCallInformation,
        },
      };
    },
  });
};
